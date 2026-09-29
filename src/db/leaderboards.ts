import { db } from "./client";
import type { LeaderboardEntry } from "@/lib/types";
import { toProfile, type ProfileRow } from "./profiles";
import { seedAccountExclusion } from "./visibility";

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

export interface SupportedRankSnapshot {
  // 1-based Most-Supported rank, computed from the SAME credit totals as
  // the public board (refunded rows contribute 0). Ties share the rank
  // number of the position above them + 1 (dense-ish); the public board
  // breaks ties by earliest-added, so treat this as the snapshot the
  // conviction record stores, not a pixel-perfect board replica.
  rank: number;
  // Distinct real supporters with net-positive credits. Synthetic seed
  // accounts are excluded — this number backs human-facing copy like
  // "you're her Nth supporter", which must never count fake accounts.
  supporterCount: number;
  totalCredits: number;
}

// Point-in-time snapshot of a nominee's Most-Supported standing, used by
// the Stripe webhook (pre-payment snapshot for conviction_records) and
// the post-payment status endpoint (live rank for the §15 impact panel).
// Returns null if the profile isn't on the ranking's board.
export async function getSupportedRankSnapshot(
  rankingId: string,
  profileId: string
): Promise<SupportedRankSnapshot | null> {
  const row = (await db
    .prepare(
      `WITH totals AS (
         SELECT p.id AS pid, COALESCE(SUM(ct.credits), 0) AS total
         FROM profiles p
         LEFT JOIN credit_transactions ct
           ON ct.profile_id = p.id AND ct.ranking_id = p.ranking_id
         WHERE p.ranking_id = ? AND p.deleted_at IS NULL
         GROUP BY p.id
       )
       SELECT
         (SELECT total FROM totals WHERE pid = ?) AS mine,
         (SELECT COUNT(*) FROM totals
          WHERE total > (SELECT total FROM totals WHERE pid = ?)) AS above`
    )
    .get(rankingId, profileId, profileId)) as unknown as {
    mine: number | null;
    above: number;
  } | undefined;
  if (!row || row.mine === null) return null;

  const countRow = (await db
    .prepare(
      `SELECT COUNT(DISTINCT ct.supporter_user_id) AS n
       FROM credit_transactions ct
       JOIN users u ON u.id = ct.supporter_user_id
       WHERE ct.ranking_id = ? AND ct.profile_id = ?
         AND ct.credits > 0 AND ${seedAccountExclusion("u")}`
    )
    .get(rankingId, profileId)) as unknown as { n: number } | undefined;

  return {
    rank: row.above + 1,
    supporterCount: countRow?.n ?? 0,
    totalCredits: row.mine,
  };
}
