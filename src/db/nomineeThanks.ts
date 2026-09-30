import { db } from "./client";
import { newId } from "@/lib/id";
import { findProfileById } from "./profiles";
import { getFirstMoments } from "./milestones";
import { createNotificationsBatch } from "./notifications";
import { buildNomineeThanksCopy } from "@/lib/storyNotifications";

// Phase 5.5 (§8 / §16 of the Support Story directive): "Thank my early
// backers" — a claimed nominee's one-click thank-you to the people who
// backed them early.
//
// Privacy (non-negotiable):
//  - the nominee NEVER sees names — only the aggregate early-backer
//    count, which includes private backers (consistent with the Phase 2
//    public-totals rule);
//  - each backer gets an individual SELF-directed notification;
//    private backers are included (self-notification is not exposure)
//    and never named anywhere;
//  - seed accounts are excluded from the recipient set
//    (getFirstMoments already excludes them).
//
// Rate limit: once per milestone scope. The scope is the nominee's
// latest milestone type at thank time ("general" when they have no
// milestone yet); UNIQUE(ranking_id, profile_id, milestone_scope) makes
// a repeat thank for the same scope a no-op, while a NEW milestone
// unlocks a new thank-you.
//
// Delivery reuses the Phase 3 notification center: notify_milestones
// pref + 5/day cap are enforced by createNotificationsBatch. Custom
// thank-you text is NOT supported (preset copy only — no moderation
// pipeline exists yet).

export type ThankBackersDenial =
  | "not_found"
  | "not_claimed"
  | "not_owner"
  | "already_thanked";

export type ThankBackersResult =
  | { ok: true; sent: number; scope: string }
  | { ok: false; reason: ThankBackersDenial; scope?: string };

// The nominee's latest milestone type — the "what are we thanking
// for" scope. One query; this path is user-triggered, not cron.
export async function getLatestMilestoneScope(
  rankingId: string,
  profileId: string
): Promise<string> {
  const row = (await db
    .prepare(
      `SELECT type FROM milestone_events
       WHERE ranking_id = ? AND profile_id = ?
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(rankingId, profileId)) as unknown as { type: string } | undefined;
  return row?.type ?? "general";
}

export async function thankEarlyBackers(params: {
  profileId: string;
  actorUserId: string;
}): Promise<ThankBackersResult> {
  const { profileId, actorUserId } = params;

  // Server-side claimed gating (the share-page UI is convenience only):
  // unclaimed → denied; claimed by someone else → denied.
  const profile = await findProfileById(profileId);
  if (!profile) return { ok: false, reason: "not_found" };
  if (profile.claimStatus !== "claimed" || !profile.claimedBy) {
    return { ok: false, reason: "not_claimed" };
  }
  if (profile.claimedBy !== actorUserId) {
    return { ok: false, reason: "not_owner" };
  }

  const scope = await getLatestMilestoneScope(profile.rankingId, profileId);
  const insert = await db
    .prepare(
      `INSERT OR IGNORE INTO nominee_thanks
        (id, ranking_id, profile_id, milestone_scope, thanked_by)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(newId(), profile.rankingId, profileId, scope, actorUserId);
  if (insert.changes === 0) {
    return { ok: false, reason: "already_thanked", scope };
  }

  // Early backers = first-moment holders per (ranking, nominee).
  // Includes private backers (self-directed notifications only);
  // excludes seed accounts and hidden users.
  const moments = await getFirstMoments(profile.rankingId, profileId);
  const copy = buildNomineeThanksCopy(profile.name);
  await createNotificationsBatch(
    moments.map((m) => ({
      userId: m.userId,
      type: "nominee_thanks" as const,
      title: copy.title,
      body: copy.body,
      link: `/rankings/${profile.rankingId}`,
    }))
  );

  // Aggregate only — no names, no recipient list, no private count.
  return { ok: true, sent: moments.length, scope };
}
