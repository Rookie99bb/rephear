import { listAllRankings, findRankingById } from "@/db/rankings";
import { findProfileById } from "@/db/profiles";
import {
  getSupportedBoardState,
  recordMilestoneEvent,
  awardEarlyBackers,
  getFirstMoments,
  EARLY_BACKER_THRESHOLDS,
  type MilestoneType,
} from "@/db/milestones";
import {
  createNotification,
  type NotificationType,
} from "@/db/notifications";
import {
  listFollowerUserIds,
  type FollowTargetType,
} from "@/db/follows";
import { emitNotificationEvent } from "@/lib/notificationEvents";
import {
  notifyClaimedOwnerForMilestone,
  checkTop10Approach,
} from "@/lib/nomineeMilestones";

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

function rankLine(rankAtSupport: number | null): string {
  return rankAtSupport === null
    ? "before she was even ranked"
    : `at #${rankAtSupport}`;
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
      const board = await getSupportedBoardState(ranking.id);
      stats.rankings++;
      // Credits total of the #10 nominee — the "approaching Top 10"
      // cutoff for claimed-owner near-miss nudges (Phase 4).
      const top10CutoffCredits =
        board.length >= 10 ? board[9].totalCredits : null;
      for (const nominee of board) {
        await processNominee(
          ranking.id,
          ranking.title,
          nominee,
          top10CutoffCredits,
          stats
        );
      }
    } catch (err) {
      stats.errors++;
      console.error(
        `[milestoneRunner] ranking ${ranking.id} failed:`,
        err
      );
    }
  }

  return stats;
}

async function processNominee(
  rankingId: string,
  rankingTitle: string,
  nominee: { profileId: string; rank: number; totalCredits: number; backerCount: number },
  top10CutoffCredits: number | null,
  stats: { events: number; awards: number; notifications: number }
) {
  const profile = await findProfileById(nominee.profileId);
  if (!profile) return;
  const name = profile.name;
  const link = `/rankings/${rankingId}`;

  // Evaluate every threshold; recordMilestoneEvent is INSERT OR IGNORE
  // so only genuinely new crossings return created=true.
  const candidates: { type: MilestoneType; entry: boolean }[] = [
    { type: "nominated", entry: false },
    ...(nominee.totalCredits >= 1000
      ? [{ type: "first_1k_credits" as MilestoneType, entry: false }]
      : []),
    ...(nominee.totalCredits >= 10000
      ? [{ type: "credits_10k" as MilestoneType, entry: false }]
      : []),
    ...(nominee.backerCount >= 50
      ? [{ type: "backers_50" as MilestoneType, entry: false }]
      : []),
    ...(nominee.rank <= 50
      ? [{ type: "entered_top_50" as MilestoneType, entry: true }]
      : []),
    ...(nominee.rank <= 20
      ? [{ type: "entered_top_20" as MilestoneType, entry: true }]
      : []),
    ...(nominee.rank <= 10
      ? [{ type: "entered_top_10" as MilestoneType, entry: true }]
      : []),
    ...(nominee.rank <= 3
      ? [{ type: "reached_3" as MilestoneType, entry: true }]
      : []),
    ...(nominee.rank === 1
      ? [{ type: "reached_1" as MilestoneType, entry: true }]
      : []),
  ];

  for (const { type, entry } of candidates) {
    const { created } = await recordMilestoneEvent({
      rankingId,
      profileId: nominee.profileId,
      type,
      rankAtEvent: nominee.rank,
      creditsAtEvent: nominee.totalCredits,
      backersAtEvent: nominee.backerCount,
    });
    if (!created) continue;
    stats.events++;

    const label = MILESTONE_LABELS[type];

    // 1. Early Backer awards on new entry thresholds (WHEN-based).
    if (type in EARLY_BACKER_THRESHOLDS) {
      const awarded = await awardEarlyBackers({
        rankingId,
        profileId: nominee.profileId,
        milestoneType: type as keyof typeof EARLY_BACKER_THRESHOLDS,
      });
      for (const userId of awarded) {
        stats.awards++;
        const first = (await getFirstMoments(rankingId, nominee.profileId)).find(
          (m) => m.userId === userId
        );
        const n = await notify({
          userId,
          type: "early_backer_milestone",
          title: `Early Backer: ${name} 🏅`,
          body: `You backed ${name} ${rankLine(first?.rankAtSupport ?? null)}, before she ${label.replace("just ", "")}. Your judgement called it early — this one's on the record.`,
          link,
        });
        stats.notifications += n;
        emitNotificationEvent({
          type: "early_backer_milestone",
          userId,
          profileId: nominee.profileId,
          rankingId,
          milestoneType: type,
          rankAtSupport: first?.rankAtSupport ?? null,
        });
      }
    }

    // 2. Self-notifications to every backer (private moments included —
    // self-notification is NOT exposure). Copy reinforces judgement /
    // belonging / history, never "support again" pressure.
    if (type !== "nominated") {
      const firstMoments = await getFirstMoments(rankingId, nominee.profileId);
      for (const m of firstMoments) {
        const n = await notify({
          userId: m.userId,
          type: "backed_nominee_milestone",
          title: `${name} ${label}`,
          body: `You backed her ${rankLine(m.rankAtSupport)} — you were there before the climb. See where the journey goes next.`,
          link,
        });
        stats.notifications += n;
        emitNotificationEvent({
          type: "backed_nominee_milestone",
          userId: m.userId,
          profileId: nominee.profileId,
          rankingId,
          milestoneType: type,
          rankAtSupport: m.rankAtSupport,
        });
      }
    }

    // 3. Follower updates: ranking followers on entry thresholds,
    // category followers on #1 only (keeps volume sane).
    if (entry && ENTRY_THRESHOLDS.has(type)) {
      const followerTargets: { targetType: FollowTargetType; targetId: string }[] = [
        { targetType: "ranking", targetId: rankingId },
      ];
      if (type === "reached_1") {
        const ranking = await findRankingById(rankingId);
        if (ranking?.categoryId) {
          followerTargets.push({
            targetType: "category",
            targetId: ranking.categoryId,
          });
        }
      }
      const seen = new Set<string>();
      for (const t of followerTargets) {
        for (const userId of await listFollowerUserIds(t.targetType, t.targetId)) {
          if (seen.has(userId)) continue;
          seen.add(userId);
          const n = await notify({
            userId,
            type: "follow_update",
            title: `${rankingTitle}: ${name} ${label}`,
            body: `${name} ${label} in ${rankingTitle}.`,
            link,
          });
          stats.notifications += n;
          emitNotificationEvent({
            type: "follow_update",
            userId,
            profileId: nominee.profileId,
            rankingId,
            milestoneType: type,
          });
        }
      }
    }

    // 4. Generic ranking_milestone event for future (5.5) templates.
    emitNotificationEvent({
      type: "ranking_milestone",
      profileId: nominee.profileId,
      rankingId,
      milestoneType: type,
      rankAtEvent: nominee.rank,
    });

    // 5. Phase 4: claimed-owner milestone ping — the owner learns a
    // milestone fired and can share their card (the growth loop).
    // Non-blocking like everything else here: a notification failure
    // must never disturb the cron.
    try {
      const { notified } = await notifyClaimedOwnerForMilestone({
        rankingId,
        rankingTitle,
        profileId: nominee.profileId,
        type,
      });
      if (notified) stats.notifications++;
    } catch (err) {
      console.error(
        `[milestoneRunner] notifyClaimedOwner failed for ${nominee.profileId}:`,
        err
      );
    }
  }

  // 6. Phase 4: "approaching Top 10" near-miss nudge for claimed owners.
  // Fires once ever per (ranking, nominee) via the UNIQUE guard inside.
  try {
    const { noticed } = await checkTop10Approach({
      rankingId,
      rankingTitle,
      profileId: nominee.profileId,
      rank: nominee.rank,
      totalCredits: nominee.totalCredits,
      top10CutoffCredits,
    });
    if (noticed) stats.notifications++;
  } catch (err) {
    console.error(
      `[milestoneRunner] checkTop10Approach failed for ${nominee.profileId}:`,
      err
    );
  }
}

// Wrapper: createNotification enforces the notify_milestones pref and
// the daily rate cap; returns 1 if a row was written, else 0.
async function notify(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
}): Promise<number> {
  const { created } = await createNotification(params);
  return created ? 1 : 0;
}
