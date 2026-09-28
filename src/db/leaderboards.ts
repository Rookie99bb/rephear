import { db } from "./client";
import type { LeaderboardEntry } from "@/lib/types";
import { toProfile, type ProfileRow } from "./profiles";

interface StatsRow extends ProfileRow {
  like_count: number;
  reputation_credits: number;
}

function toEntry(row: StatsRow): LeaderboardEntry {
  return {
    profile: toProfile(row),
    likeCount: row.like_count,
    reputationCredits: row.reputation_credits,
  };
}

// One query gets both stats for every Nominee in a Ranking. Nominees
// belong directly to a Ranking now (no join table), so this is a plain
// filter on profiles.ranking_id.
async function getRankingStats(
  rankingId: string
): Promise<{ entry: LeaderboardEntry; addedAt: string }[]> {
  const rows = (await db
    .prepare(
      `SELECT p.*,
(SELECT COALESCE(SUM(l.count), 0) FROM likes l WHERE l.ranking_id = ? AND l.profile_id = p.id) AS like_count,
(SELECT COALESCE(SUM(ct.credits), 0) FROM credit_transactions ct WHERE ct.ranking_id = ? AND ct.profile_id = p.id) AS reputation_credits
FROM profiles p
WHERE p.ranking_id = ? AND p.deleted_at IS NULL`
    )
    .all(rankingId, rankingId, rankingId)) as unknown as StatsRow[];
  return rows.map((row) => ({ entry: toEntry(row), addedAt: row.created_at }));
}

// Most Loved: sorted ONLY by Total Likes, descending. Never mixed with
// Reputation Credits. Ties broken by a neutral signal (earliest added to
// the Ranking) so ordering stays deterministic across renders.
export async function getMostLoved(rankingId: string): Promise<LeaderboardEntry[]> {
  return (await getRankingStats(rankingId))
    .sort(
      (a, b) =>
        b.entry.likeCount - a.entry.likeCount ||
        a.addedAt.localeCompare(b.addedAt)
    )
    .map((r) => r.entry);
}

// Most Supported: sorted ONLY by Total Reputation Credits received,
// descending. Never mixed with Likes.
export async function getMostSupported(rankingId: string): Promise<LeaderboardEntry[]> {
  return (await getRankingStats(rankingId))
    .sort(
      (a, b) =>
        b.entry.reputationCredits - a.entry.reputationCredits ||
        a.addedAt.localeCompare(b.addedAt)
    )
    .map((r) => r.entry);
}

// One query, both leaderboards. getMostLoved/getMostSupported each run
// getRankingStats on their own, so calling both on the ranking page meant
// the same heavy stats query twice per load (Turso over HTTP: double the
// round trips). Fetch once here and sort twice in JS instead — the sort
// keys are the only difference between the two boards.
export async function getLeaderboards(rankingId: string): Promise<{
  mostLoved: LeaderboardEntry[];
  mostSupported: LeaderboardEntry[];
}> {
  const stats = await getRankingStats(rankingId);
  const mostLoved = [...stats]
    .sort(
      (a, b) =>
        b.entry.likeCount - a.entry.likeCount ||
        a.addedAt.localeCompare(b.addedAt)
    )
    .map((r) => r.entry);
  const mostSupported = [...stats]
    .sort(
      (a, b) =>
        b.entry.reputationCredits - a.entry.reputationCredits ||
        a.addedAt.localeCompare(b.addedAt)
    )
    .map((r) => r.entry);
  return { mostLoved, mostSupported };
}
