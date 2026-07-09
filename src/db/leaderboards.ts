import { db } from "./client";
import type { LeaderboardEntry } from "@/lib/types";
import { toProfile, type ProfileRow } from "./profiles";

interface StatsRow extends ProfileRow {
  like_count: number;
  reputation_credits: number;
  added_at: string;
}

function toEntry(row: StatsRow): LeaderboardEntry {
  return {
    profile: toProfile(row),
    likeCount: row.like_count,
    reputationCredits: row.reputation_credits,
  };
}

// One query gets both stats for every Nominee in a Ranking, plus when they
// were added to it (added_at) — used only as a neutral tiebreaker so
// ordering is deterministic without ever mixing the two ranking metrics.
function getRankingStats(
  rankingId: string
): { entry: LeaderboardEntry; addedAt: string }[] {
  const rows = db
    .prepare(
      `SELECT p.*, rp.created_at AS added_at,
        (SELECT COUNT(*) FROM likes l WHERE l.ranking_id = ? AND l.profile_id = p.id) AS like_count,
        (SELECT COALESCE(SUM(ct.credits), 0) FROM credit_transactions ct WHERE ct.ranking_id = ? AND ct.profile_id = p.id) AS reputation_credits
       FROM profiles p
       JOIN ranking_profiles rp ON rp.profile_id = p.id
       WHERE rp.ranking_id = ? AND rp.deleted_at IS NULL`
    )
    .all(rankingId, rankingId, rankingId) as unknown as StatsRow[];
  return rows.map((row) => ({ entry: toEntry(row), addedAt: row.added_at }));
}

// Most Loved: sorted ONLY by Total Likes, descending. Never mixed with
// Reputation Credits. Ties broken by a neutral signal (earliest added to
// the Ranking) so ordering stays deterministic across renders.
export function getMostLoved(rankingId: string): LeaderboardEntry[] {
  return getRankingStats(rankingId)
    .sort(
      (a, b) =>
        b.entry.likeCount - a.entry.likeCount ||
        a.addedAt.localeCompare(b.addedAt)
    )
    .map((r) => r.entry);
}

// Most Supported: sorted ONLY by Total Reputation Credits received,
// descending. Never mixed with Likes.
export function getMostSupported(rankingId: string): LeaderboardEntry[] {
  return getRankingStats(rankingId)
    .sort(
      (a, b) =>
        b.entry.reputationCredits - a.entry.reputationCredits ||
        a.addedAt.localeCompare(b.addedAt)
    )
    .map((r) => r.entry);
}
