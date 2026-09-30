import { listAllRankings } from "@/db/rankings";
import type { Ranking } from "@/lib/types";
import {
  getSupportedBoardState,
  recordMilestoneEventsBatch,
  getRankingProfileBasics,
  getFirstMomentsBatch,
  awardEarlyBackersBatch,
  EARLY_BACKER_THRESHOLDS,
  type MilestoneType,
  type MilestoneCandidate,
  type FirstMomentWithProfile,
  type EarlyBackerAwardItem,
} from "@/db/milestones";
import {
  createNotificationsBatch,
  getNotifyMilestonesPrefs,
  type NotificationBatchItem,
} from "@/db/notifications";
import {
  listFollowerUserIdsForTargets,
  type FollowTargetType,
} from "@/db/follows";
import {
  emitNotificationEvent,
  type NotificationEvent,
} from "@/lib/notificationEvents";
import {
  OWNER_COPY,
  recordApproachNoticesBatch,
} from "@/lib/nomineeMilestones";
import {
  buildBackerMilestoneCopy,
  buildEarlyBackerStoryCopy,
} from "@/lib/storyNotifications";
import {
  findIdentityCandidates,
  awardIdentitiesForUsers,
} from "@/db/identityAwards";

// Phase 3 (§7, §14): milestone detection core, shared by the
// /api/cron/backing-milestones route and the Phase 3 smoke test.
//
// For every public ranking it:
//  1. records threshold crossings into milestone_events (INSERT OR
//     IGNORE — each threshold fires once per nominee, EVER),
//  2. awards Early Backer recognition from backing_moments first-moments
//     (WHEN-based, never HOW MUCH) when an entry threshold is new,
//  3. sends in-app notifications: self-notifications to backers
//     (private moments included — self-notification is NOT exposure),
//     award notifications, and follow_update pings to ranking/category
//     followers.
//
// Safe to run on any schedule: idempotent throughout, and a failure on
// one ranking never stops the others (per-ranking try/catch).
//
// BATCHED for remote Turso: every per-ranking step is a constant
// handful of statements (board state, profile basics, one chunked
// event INSERT ... RETURNING, one moments query, one followers query,
// one notification flush) instead of thousands of sequential
// per-nominee round-trips. Same rows, same events, same idempotency —
// only the access pattern changed.

export interface MilestoneRunStats {
  rankings: number;
  events: number;
  awards: number;
  notifications: number;
  errors: number;
}

const MILESTONE_LABELS: Record<MilestoneType, string> = {
  nominated: "was just nominated",
  first_1k_credits: "just passed 1,000 Support Credits",
  backers_50: "just reached 50 backers",
  entered_top_50: "just entered the Top 50",
  entered_top_20: "just entered the Top 20",
  entered_top_10: "just entered the Top 10 🎉",
  credits_10k: "just passed 10,000 Support Credits",
  reached_3: "just reached #3 🥉",
  reached_1: "just reached #1 🏆",
};

// Entry thresholds: the ones that award Early Backers and ping
// followers. Pure volume thresholds (credits/backers) don't — they
// notify the nominee's own backers only.
const ENTRY_THRESHOLDS = new Set<MilestoneType>([
  "entered_top_50",
  "entered_top_20",
  "entered_top_10",
  "reached_3",
  "reached_1",
]);

// Phase 4: near-miss nudge gate (mirrors checkTop10Approach).
const APPROACH_MAX_GAP_CREDITS = 1000;

interface Candidate extends MilestoneCandidate {
  entry: boolean;
}

// A notification queued for the end-of-ranking flush, plus which
// (console-only) event to emit for it: always, or only when the
// notification actually landed.
interface QueuedNotification extends NotificationBatchItem {
  emitAlways?: NotificationEvent;
  emitIfCreated?: NotificationEvent;
}

export async function runMilestoneDetection(): Promise<MilestoneRunStats> {
  const stats: MilestoneRunStats = {
    rankings: 0,
    events: 0,
    awards: 0,
    notifications: 0,
    errors: 0,
  };

  const rankings = await listAllRankings();
  for (const ranking of rankings) {
    try {
      await processRanking(ranking, stats);
    } catch (err) {
      stats.errors++;
      console.error(`[milestoneRunner] ranking ${ranking.id} failed:`, err);
    }
  }

  // 7. Phase 5.7: evidence-based identities. Daily candidates only (1
  // statement) — the full backfill path stays manual. Notifications for
  // newly earned identities are queued inside awardIdentitiesForUsers
  // via the Phase 3 center (pref + 5/day cap).
  try {
    const candidates = await findIdentityCandidates();
    const identityRun = await awardIdentitiesForUsers(candidates);
    console.info(
      `[milestoneRunner] identities: evaluated ${identityRun.evaluated}, newly awarded ${identityRun.awarded.length}`
    );
  } catch (err) {
    stats.errors++;
    console.error("[milestoneRunner] identity evaluation failed:", err);
  }

  return stats;
}

async function processRanking(
  ranking: Ranking,
  stats: MilestoneRunStats
): Promise<void> {
  const rankingId = ranking.id;
  const rankingTitle = ranking.title;
  const link = `/rankings/${rankingId}`;

  // Board state + profile basics: 2 statements for the whole ranking.
  const board = await getSupportedBoardState(rankingId);
  stats.rankings++;
  const basics = await getRankingProfileBasics(rankingId);
  // Credits total of the #10 nominee — the "approaching Top 10"
  // cutoff for claimed-owner near-miss nudges (Phase 4).
  const top10CutoffCredits =
    board.length >= 10 ? board[9].totalCredits : null;

  // 1. Threshold candidates for every nominee, in the same order the
  // old per-nominee loop evaluated them.
  const candidates: Candidate[] = [];
  for (const nominee of board) {
    candidates.push(
      {
        profileId: nominee.profileId,
        type: "nominated",
        rankAtEvent: nominee.rank,
        creditsAtEvent: nominee.totalCredits,
        backersAtEvent: nominee.backerCount,
        entry: false,
      },
      ...(nominee.totalCredits >= 1000
        ? [
            {
              profileId: nominee.profileId,
              type: "first_1k_credits" as MilestoneType,
              rankAtEvent: nominee.rank,
              creditsAtEvent: nominee.totalCredits,
              backersAtEvent: nominee.backerCount,
              entry: false,
            },
          ]
        : []),
      ...(nominee.totalCredits >= 10000
        ? [
            {
              profileId: nominee.profileId,
              type: "credits_10k" as MilestoneType,
              rankAtEvent: nominee.rank,
              creditsAtEvent: nominee.totalCredits,
              backersAtEvent: nominee.backerCount,
              entry: false,
            },
          ]
        : []),
      ...(nominee.backerCount >= 50
        ? [
            {
              profileId: nominee.profileId,
              type: "backers_50" as MilestoneType,
              rankAtEvent: nominee.rank,
              creditsAtEvent: nominee.totalCredits,
              backersAtEvent: nominee.backerCount,
              entry: false,
            },
          ]
        : []),
      ...(nominee.rank <= 50
        ? [
            {
              profileId: nominee.profileId,
              type: "entered_top_50" as MilestoneType,
              rankAtEvent: nominee.rank,
              creditsAtEvent: nominee.totalCredits,
              backersAtEvent: nominee.backerCount,
              entry: true,
            },
          ]
        : []),
      ...(nominee.rank <= 20
        ? [
            {
              profileId: nominee.profileId,
              type: "entered_top_20" as MilestoneType,
              rankAtEvent: nominee.rank,
              creditsAtEvent: nominee.totalCredits,
              backersAtEvent: nominee.backerCount,
              entry: true,
            },
          ]
        : []),
      ...(nominee.rank <= 10
        ? [
            {
              profileId: nominee.profileId,
              type: "entered_top_10" as MilestoneType,
              rankAtEvent: nominee.rank,
              creditsAtEvent: nominee.totalCredits,
              backersAtEvent: nominee.backerCount,
              entry: true,
            },
          ]
        : []),
      ...(nominee.rank <= 3
        ? [
            {
              profileId: nominee.profileId,
              type: "reached_3" as MilestoneType,
              rankAtEvent: nominee.rank,
              creditsAtEvent: nominee.totalCredits,
              backersAtEvent: nominee.backerCount,
              entry: true,
            },
          ]
        : []),
      ...(nominee.rank === 1
        ? [
            {
              profileId: nominee.profileId,
              type: "reached_1" as MilestoneType,
              rankAtEvent: nominee.rank,
              creditsAtEvent: nominee.totalCredits,
              backersAtEvent: nominee.backerCount,
              entry: true,
            },
          ]
        : [])
    );
  }

  // 2. Record crossings: one chunked INSERT OR IGNORE ... RETURNING.
  // The returned keys are exactly the genuinely new crossings.
  const createdKeys = await recordMilestoneEventsBatch(rankingId, candidates);
  const newEvents = candidates.filter((c) =>
    createdKeys.has(`${c.profileId}|${c.type}`)
  );
  stats.events += newEvents.length;
  const newByProfile = new Map<string, Candidate[]>();
  for (const e of newEvents) {
    const list = newByProfile.get(e.profileId);
    if (list) list.push(e);
    else newByProfile.set(e.profileId, [e]);
  }

  // 3. Bulk prefetches — each skipped entirely when nothing needs it.
  const needMoments = new Set<string>();
  for (const e of newEvents) {
    if (e.type in EARLY_BACKER_THRESHOLDS || e.type !== "nominated") {
      needMoments.add(e.profileId);
    }
  }
  const moments = await getFirstMomentsBatch(rankingId, [...needMoments]);
  const momentsByProfile = new Map<string, FirstMomentWithProfile[]>();
  const momentByUser = new Map<string, FirstMomentWithProfile>();
  for (const m of moments) {
    const list = momentsByProfile.get(m.profileId);
    if (list) list.push(m);
    else momentsByProfile.set(m.profileId, [m]);
    momentByUser.set(`${m.profileId}|${m.userId}`, m);
  }

  const followerTargets: { targetType: FollowTargetType; targetId: string }[] =
    [];
  if (newEvents.some((e) => e.entry)) {
    followerTargets.push({ targetType: "ranking", targetId: rankingId });
  }
  if (
    newEvents.some((e) => e.type === "reached_1") &&
    ranking.categoryId
  ) {
    followerTargets.push({
      targetType: "category",
      targetId: ranking.categoryId,
    });
  }
  const followersByTarget =
    await listFollowerUserIdsForTargets(followerTargets);

  // 4. Early Backer awards (WHEN-based), one chunked INSERT ... RETURNING.
  const awardItems: EarlyBackerAwardItem[] = [];
  for (const e of newEvents) {
    if (!(e.type in EARLY_BACKER_THRESHOLDS)) continue;
    const threshold = EARLY_BACKER_THRESHOLDS[e.type];
    for (const m of momentsByProfile.get(e.profileId) ?? []) {
      // They backed before the crossing iff the nominee ranked worse
      // than the threshold (or wasn't ranked at all) when they backed.
      if (m.rankAtSupport !== null && m.rankAtSupport <= threshold) continue;
      awardItems.push({
        rankingId,
        profileId: e.profileId,
        milestoneType: e.type,
        userId: m.userId,
      });
    }
  }
  const createdAwards = await awardEarlyBackersBatch(awardItems);
  stats.awards += createdAwards.size;

  // 5. Phase 4: Top-10 approach pre-filter. The once-ever notice row is
  // recorded only for pref-on owners (same rule as
  // checkTop10Approach); the notification itself joins the flush below.
  const approachInserts: {
    profileId: string;
    gap: number;
    ownerId: string;
    name: string;
  }[] = [];
  for (const nominee of board) {
    if (nominee.rank <= 10) continue;
    if (top10CutoffCredits === null) continue;
    const gap = top10CutoffCredits - nominee.totalCredits;
    if (gap <= 0 || gap > APPROACH_MAX_GAP_CREDITS) continue;
    const basic = basics.get(nominee.profileId);
    if (!basic || basic.claimStatus !== "claimed" || !basic.claimedBy) continue;
    approachInserts.push({
      profileId: nominee.profileId,
      gap,
      ownerId: basic.claimedBy,
      name: basic.name,
    });
  }
  let approachCreated = new Set<string>();
  const approachByProfile = new Map<string, (typeof approachInserts)[number]>();
  if (approachInserts.length > 0) {
    const prefs = await getNotifyMilestonesPrefs(
      approachInserts.map((a) => a.ownerId)
    );
    // Don't consume the once-ever notice when the owner can't receive
    // it — the next cron run tries again if they're still in range.
    const eligible = approachInserts.filter(
      (a) => prefs.get(a.ownerId) ?? true
    );
    approachCreated = await recordApproachNoticesBatch(
      eligible.map((a) => ({
        rankingId,
        profileId: a.profileId,
        gapCredits: a.gap,
      }))
    );
    for (const a of eligible) {
      if (approachCreated.has(a.profileId)) approachByProfile.set(a.profileId, a);
    }
  }

  // 6. Collect every notification in the exact order the old
  // sequential code produced them (nominee by nominee, event by
  // event), so the per-user daily rate cap drops the same items.
  const queue: QueuedNotification[] = [];
  for (const nominee of board) {
    const basic = basics.get(nominee.profileId);
    if (!basic) continue;
    const name = basic.name;

    for (const e of newByProfile.get(nominee.profileId) ?? []) {
      const label = MILESTONE_LABELS[e.type];

      // 6a. Early Backer award notifications (WHEN-based). 5.5:
      // story-framed — "you were there early" is safe here because the
      // award itself is the data proof. Award recipients skip the
      // generic 6b story ping for the same event (one notification per
      // event per user).
      const awardedUsers = new Set<string>();
      if (e.type in EARLY_BACKER_THRESHOLDS) {
        for (const item of awardItems) {
          if (item.profileId !== e.profileId || item.milestoneType !== e.type)
            continue;
          const key = `${rankingId}|${e.profileId}|${e.type}|${item.userId}`;
          if (!createdAwards.has(key)) continue;
          awardedUsers.add(item.userId);
          const first = momentByUser.get(`${e.profileId}|${item.userId}`);
          const rankAtSupport = first?.rankAtSupport ?? null;
          const copy = buildEarlyBackerStoryCopy({
            profileName: name,
            milestoneType: e.type,
            rankAtSupport,
            rankAtEvent: e.rankAtEvent,
            provenEarly: true,
            amongFirstBackers: false,
          });
          queue.push({
            userId: item.userId,
            type: "early_backer_milestone",
            title: copy.title,
            body: copy.body,
            link,
            emitAlways: {
              type: "early_backer_milestone",
              userId: item.userId,
              profileId: e.profileId,
              rankingId,
              milestoneType: e.type,
              rankAtSupport,
            },
          });
        }
      }

      // 6b. Story self-notifications to every backer (private moments
      // included — self-notification is NOT exposure). 5.5:
      // story-framed THEN→NOW with real ranks ("You backed Mia at #23.
      // Mia is now #3."). backers_50 gates "one of the first" on
      // provable earliest-50 moment order — a JS sort over the already
      // prefetched moments, so the cron's query budget is untouched.
      if (e.type !== "nominated") {
        const profileMoments = momentsByProfile.get(e.profileId) ?? [];
        let firstFifty: Set<string> | null = null;
        if (e.type === "backers_50") {
          const ordered = [...profileMoments].sort((a, b) =>
            a.supportedAt < b.supportedAt
              ? -1
              : a.supportedAt > b.supportedAt
                ? 1
                : 0
          );
          firstFifty = new Set(ordered.slice(0, 50).map((m) => m.userId));
        }
        for (const m of profileMoments) {
          if (awardedUsers.has(m.userId)) continue; // got the 6a early story
          const copy = buildBackerMilestoneCopy({
            profileName: name,
            milestoneType: e.type,
            rankAtSupport: m.rankAtSupport,
            rankAtEvent: e.rankAtEvent,
            provenEarly: false,
            amongFirstBackers: firstFifty?.has(m.userId) ?? false,
          });
          queue.push({
            userId: m.userId,
            type: "backed_nominee_milestone",
            title: copy.title,
            body: copy.body,
            link,
            emitAlways: {
              type: "backed_nominee_milestone",
              userId: m.userId,
              profileId: e.profileId,
              rankingId,
              milestoneType: e.type,
              rankAtSupport: m.rankAtSupport,
            },
          });
        }
      }

      // 6c. Follower updates: ranking followers on entry thresholds,
      // category followers on #1 only (keeps volume sane).
      if (e.entry && ENTRY_THRESHOLDS.has(e.type)) {
        const targets: { targetType: FollowTargetType; targetId: string }[] = [
          { targetType: "ranking", targetId: rankingId },
        ];
        if (e.type === "reached_1" && ranking.categoryId) {
          targets.push({
            targetType: "category",
            targetId: ranking.categoryId,
          });
        }
        const seen = new Set<string>();
        for (const t of targets) {
          for (const userId of followersByTarget.get(
            `${t.targetType}:${t.targetId}`
          ) ?? []) {
            if (seen.has(userId)) continue;
            seen.add(userId);
            queue.push({
              userId,
              type: "follow_update",
              title: `${rankingTitle}: ${name} ${label}`,
              body: `${name} ${label} in ${rankingTitle}.`,
              link,
              emitAlways: {
                type: "follow_update",
                userId,
                profileId: e.profileId,
                rankingId,
                milestoneType: e.type,
              },
            });
          }
        }
      }

      // 6d. Generic ranking_milestone event for future (5.5) templates.
      emitNotificationEvent({
        type: "ranking_milestone",
        profileId: e.profileId,
        rankingId,
        milestoneType: e.type,
        rankAtEvent: e.rankAtEvent,
      });

      // 6e. Phase 4: claimed-owner milestone ping — the owner learns a
      // milestone fired and can share their card (the growth loop).
      // "nominated" is skipped: on backfill it fires for every nominee
      // at once, and "you exist on a board" is noise, not a milestone.
      if (
        e.type !== "nominated" &&
        basic.claimStatus === "claimed" &&
        basic.claimedBy
      ) {
        const copy = OWNER_COPY[e.type];
        queue.push({
          userId: basic.claimedBy,
          type: "nominee_milestone",
          title: copy.title,
          body: copy.body(name, rankingTitle),
          link: `/profiles/${e.profileId}/share`,
          emitIfCreated: {
            type: "nominee_owner_milestone",
            userId: basic.claimedBy,
            profileId: e.profileId,
            rankingId,
            milestoneType: e.type,
          },
        });
      }
    }

    // 6f. Phase 4: "approaching Top 10" near-miss nudge for claimed
    // owners. Fires once ever per (ranking, nominee).
    const approach = approachByProfile.get(nominee.profileId);
    if (approach) {
      const gapLabel = approach.gap.toLocaleString("en-US");
      queue.push({
        userId: approach.ownerId,
        type: "nominee_milestone",
        title: `You're ${gapLabel} credits from the Top 10`,
        body: `${approach.name} is ${gapLabel} Support Credits away from the Top 10 in ${rankingTitle}. Share your story and let your people know.`,
        link: `/profiles/${nominee.profileId}/share`,
        emitIfCreated: {
          type: "nominee_owner_milestone",
          userId: approach.ownerId,
          profileId: nominee.profileId,
          rankingId,
          milestoneType: "approaching_top_10",
        },
      });
    }
  }

  // 7. One flush for the whole ranking: pref gate + daily cap are
  // evaluated in queue order, exactly as sequential
  // createNotification calls would decide them.
  const { created, createdFlags } = await createNotificationsBatch(queue);
  stats.notifications += created;
  queue.forEach((item, i) => {
    if (item.emitAlways) emitNotificationEvent(item.emitAlways);
    else if (item.emitIfCreated && createdFlags[i]) {
      emitNotificationEvent(item.emitIfCreated);
    }
  });
}
