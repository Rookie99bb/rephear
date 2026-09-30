import { db } from "@/db/client";
import { newId } from "@/lib/id";
import { findProfileById } from "@/db/profiles";
import { createNotification, getNotifyMilestonesPref } from "@/db/notifications";
import { emitNotificationEvent } from "@/lib/notificationEvents";
import type { MilestoneType } from "@/db/milestones";

// Phase 4 (nominee growth loop): milestone notifications to CLAIMED
// owners — the other half of the growth loop (milestone → owner gets
// pinged → shares their card → new users).
//
// Rules:
// - Claimed-owner-only: unclaimed nominees have no owner to notify.
// - Real data only: fired from milestone_events rows (threshold
//   crossings) or the live board (top-10 approach), never fabricated.
// - Credits-only, no fiat. Copy celebrates the milestone and points at
//   the share card — never "support again" pressure.
// - createNotification enforces the notify_milestones pref + the 5/day
//   rate cap, same as every other milestone ping.

// Exported for the batched milestone cron, which inlines the
// claimed-owner lookup (one profile map per ranking) but reuses the
// exact same copy.
export const OWNER_COPY: Record<
  Exclude<MilestoneType, "nominated">,
  { title: string; body: (name: string, rankingTitle: string) => string }
> = {
  first_1k_credits: {
    title: "1,000 Support Credits 🎉",
    body: (name, rankingTitle) =>
      `${name} just passed 1,000 Support Credits in ${rankingTitle}. Your milestone card is ready — share the moment.`,
  },
  backers_50: {
    title: "50 backers ❤️",
    body: (name, rankingTitle) =>
      `${name} just reached 50 backers in ${rankingTitle}. Fifty people chose to stand behind you — your card is ready to share.`,
  },
  entered_top_50: {
    title: "You entered the Top 50",
    body: (name, rankingTitle) =>
      `${name} just entered the Top 50 in ${rankingTitle}. The climb is on — share your milestone card.`,
  },
  entered_top_20: {
    title: "You entered the Top 20",
    body: (name, rankingTitle) =>
      `${name} just entered the Top 20 in ${rankingTitle}. Your backers got you here — your card is ready to share.`,
  },
  entered_top_10: {
    title: "You entered the Top 10 🎉",
    body: (name, rankingTitle) =>
      `${name} just entered the Top 10 in ${rankingTitle}. This is the one to share — your milestone card is ready.`,
  },
  credits_10k: {
    title: "10,000 Support Credits 🏆",
    body: (name, rankingTitle) =>
      `${name} just passed 10,000 Support Credits in ${rankingTitle}. A serious milestone — your card is ready to share.`,
  },
  reached_3: {
    title: "You reached #3 🥉",
    body: (name, rankingTitle) =>
      `${name} just reached #3 in ${rankingTitle}. One step from the top — share your milestone card.`,
  },
  reached_1: {
    title: "You're #1 🏆",
    body: (name, rankingTitle) =>
      `${name} is #1 in ${rankingTitle}. The crown is yours — your milestone card is ready to share.`,
  },
};

// Called by the milestone cron when a threshold crossing is newly
// recorded (created=true). Notifies the claiming owner, if any.
// "nominated" is deliberately skipped: on backfill it fires for every
// nominee at once, and "you exist on a board" is noise, not a
// milestone.
export async function notifyClaimedOwnerForMilestone(params: {
  rankingId: string;
  rankingTitle: string;
  profileId: string;
  type: MilestoneType;
}): Promise<{ notified: boolean; reason?: string }> {
  const { rankingId, rankingTitle, profileId, type } = params;
  if (type === "nominated") return { notified: false, reason: "skip_nominated" };

  const profile = await findProfileById(profileId);
  if (!profile || profile.claimStatus !== "claimed" || !profile.claimedBy) {
    return { notified: false, reason: "unclaimed" };
  }

  const copy = OWNER_COPY[type];
  const { created } = await createNotification({
    userId: profile.claimedBy,
    type: "nominee_milestone",
    title: copy.title,
    body: copy.body(profile.name, rankingTitle),
    link: `/profiles/${profileId}/share`,
  });
  if (created) {
    emitNotificationEvent({
      type: "nominee_owner_milestone",
      userId: profile.claimedBy,
      profileId,
      rankingId,
      milestoneType: type,
    });
  }
  return { notified: created, reason: created ? undefined : "pref_or_cap" };
}

// Batched variant for the milestone cron: records many Top-10
// approach notices with chunked multi-row INSERT OR IGNORE ...
// RETURNING. Returns the profileIds that were actually inserted — the
// batch equivalent of checkTop10Approach's once-ever UNIQUE guard.
// Callers must pre-filter (rank > 10, gap in (0, 1000], claimed owner,
// pref on) exactly as checkTop10Approach does; in particular the
// once-ever row is NOT consumed when the owner's pref is off.
export async function recordApproachNoticesBatch(
  items: { rankingId: string; profileId: string; gapCredits: number }[]
): Promise<Set<string>> {
  const created = new Set<string>();
  const CHUNK = 250;
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    const values = chunk.map(() => "(?, ?, ?, ?, ?)").join(",");
    const args: (string | number)[] = chunk.flatMap((it) => [
      newId(),
      it.rankingId,
      it.profileId,
      APPROACH_THRESHOLD,
      it.gapCredits,
    ]);
    const rows = (await db
      .prepare(
        `INSERT OR IGNORE INTO nominee_approach_notices
           (id, ranking_id, profile_id, threshold, gap_credits)
         VALUES ${values}
         RETURNING profile_id`
      )
      .all(...args)) as unknown as { profile_id: string }[];
    for (const r of rows) created.add(r.profile_id);
  }
  return created;
}

// Near-miss nudge: claimed nominee outside the Top 10 but within
// striking distance. Fires ONCE ever per (ranking, nominee) via the
// UNIQUE guard — a nominee who falls back and returns is not re-pinged.
const APPROACH_THRESHOLD = "top_10";
const APPROACH_MAX_GAP_CREDITS = 1000;

export async function checkTop10Approach(params: {
  rankingId: string;
  rankingTitle: string;
  profileId: string;
  rank: number;
  totalCredits: number;
  top10CutoffCredits: number | null;
}): Promise<{ noticed: boolean; reason?: string }> {
  const {
    rankingId,
    rankingTitle,
    profileId,
    rank,
    totalCredits,
    top10CutoffCredits,
  } = params;
  if (rank <= 10) return { noticed: false, reason: "already_top_10" };
  if (top10CutoffCredits === null) return { noticed: false, reason: "no_cutoff" };
  const gap = top10CutoffCredits - totalCredits;
  if (gap <= 0 || gap > APPROACH_MAX_GAP_CREDITS) {
    return { noticed: false, reason: "gap_out_of_range" };
  }

  const profile = await findProfileById(profileId);
  if (!profile || profile.claimStatus !== "claimed" || !profile.claimedBy) {
    return { noticed: false, reason: "unclaimed" };
  }
  // Don't consume the once-ever notice when the owner can't receive it —
  // the next cron run will try again if they're still in range.
  if (!(await getNotifyMilestonesPref(profile.claimedBy))) {
    return { noticed: false, reason: "pref_off" };
  }

  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO nominee_approach_notices
         (id, ranking_id, profile_id, threshold, gap_credits)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(newId(), rankingId, profileId, APPROACH_THRESHOLD, gap);
  if (result.changes === 0) {
    return { noticed: false, reason: "already_noticed" };
  }

  const gapLabel = gap.toLocaleString("en-US");
  const { created } = await createNotification({
    userId: profile.claimedBy,
    type: "nominee_milestone",
    title: `You're ${gapLabel} credits from the Top 10`,
    body: `${profile.name} is ${gapLabel} Support Credits away from the Top 10 in ${rankingTitle}. Share your story and let your people know.`,
    link: `/profiles/${profileId}/share`,
  });
  if (created) {
    emitNotificationEvent({
      type: "nominee_owner_milestone",
      userId: profile.claimedBy,
      profileId,
      rankingId,
      milestoneType: "approaching_top_10",
    });
  }
  return { noticed: created, reason: created ? undefined : "pref_or_cap" };
}
