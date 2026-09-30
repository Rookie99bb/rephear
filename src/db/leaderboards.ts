import { db } from "./client";
import type { LeaderboardEntry } from "@/lib/types";
import { toProfile, type ProfileRow } from "./profiles";
import { seedAccountExclusion } from "./visibility";
import {
  getActiveSeedScores,
  effectiveSeedScore,
  type SeedScoreRow,
} from "./seedScores";
import { getLikeWeights, weightedLikeScore } from "./engagementWeights";

interface StatsRow extends ProfileRow {
  organic_likes: number;
  organic_likers: number;
  decayed_legacy_seed: number;
  support_credits: number;
}

// Legacy seed likes (fake rows in the likes table from the old Seed Likes
// Policy) decay linearly to zero over 30 days from each row's created_at.
// They are NEVER displayed — this only preserves a graceful cold-start
// ordering while the transparent seed_scores table takes over.
const LEGACY_SEED_DECAY_DAYS = 30;

function toEntry(
  row: StatsRow,
  seedRowsByProfile: Map<string, SeedScoreRow[]>,
  weights: { seedWeight: number; organicWeight: number },
  nowIso: string
): { entry: LeaderboardEntry; addedAt: string } {
  const organicLikes = Number(row.organic_likes) || 0;
  const organicLikers = Number(row.organic_likers) || 0;
  const legacySeed = Number(row.decayed_legacy_seed) || 0;
  const supportCredits = Number(row.support_credits) || 0;

  let newSeed = 0;
  const seedRows = seedRowsByProfile.get(row.id);
  if (seedRows) {
    for (const s of seedRows) {
      newSeed += effectiveSeedScore(s, organicLikes, organicLikers, nowIso);
    }
  }
  const seedScore = legacySeed + newSeed;
  // likeScore: the internal Most-Loved sort key (方案C). Weighted blend of
  // the cold-start weight and real Likes — sort-only, NEVER displayed as a
  // like count. Changing the weights reorders the board but can never
  // change the organicLikeCount any page renders.
  const likeScore = weightedLikeScore(seedScore, organicLikes, weights);
  return {
    entry: {
      profile: toProfile(row),
      // The ONLY number ever shown next to a Like button.
      organicLikeCount: organicLikes,
      // Cold-start ordering weight only. Never displayed as likes.
      seedScore,
      supportScore: supportCredits,
      likeScore,
      seedLikes: legacySeed,
      organicLikes,
    },
    addedAt: row.created_at,
  };
}

// One query gets both stats for every Nominee in a Ranking. Nominees
// belong directly to a Ranking now (no join table), so this is a plain
// filter on profiles.ranking_id.
async function getRankingStats(
  rankingId: string
): Promise<{ entry: LeaderboardEntry; addedAt: string }[]> {
  const nowIso = new Date().toISOString();
  const weights = await getLikeWeights().catch(() => ({
    seedWeight: 1.0,
    organicWeight: 1.0,
  }));
  const seedRows = await getActiveSeedScores(rankingId).catch(() => []);
  const seedRowsByProfile = new Map<string, SeedScoreRow[]>();
  for (const s of seedRows) {
    const arr = seedRowsByProfile.get(s.profile_id) ?? [];
    arr.push(s);
    seedRowsByProfile.set(s.profile_id, arr);
  }
  const rows = (await db
    .prepare(
      `SELECT p.*,
(SELECT COALESCE(SUM(l.count), 0) FROM likes l WHERE l.ranking_id = ? AND l.profile_id = p.id AND l.like_source = 'organic') AS organic_likes,
(SELECT COUNT(DISTINCT l.user_id) FROM likes l WHERE l.ranking_id = ? AND l.profile_id = p.id AND l.like_source = 'organic') AS organic_likers,
(SELECT COALESCE(SUM(l.count * MAX(0, 1 - (julianday('now') - COALESCE(julianday(l.created_at), julianday('now'))) / ?)), 0) FROM likes l WHERE l.ranking_id = ? AND l.profile_id = p.id AND l.like_source = 'seed') AS decayed_legacy_seed,
(SELECT COALESCE(SUM(ct.credits), 0) FROM credit_transactions ct WHERE ct.ranking_id = ? AND ct.profile_id = p.id AND ct.refunded_at IS NULL) AS support_credits
FROM profiles p
WHERE p.ranking_id = ? AND p.deleted_at IS NULL`
    )
    .all(
      rankingId,
      rankingId,
      LEGACY_SEED_DECAY_DAYS,
      rankingId,
      rankingId,
      rankingId
    )) as unknown as StatsRow[];
  return rows.map((row) => toEntry(row, seedRowsByProfile, weights, nowIso));
}

// Most Loved: sorted by likeScore (the weighted internal sort key),
// descending. likeScore blends the cold-start weight with real Likes; it
// is NEVER displayed — the number on every card stays organicLikeCount.
// Final tiebreak is earliest-added (deterministic, no randomness). Never
// mixed with Support Credits.
export async function getMostLoved(rankingId: string): Promise<LeaderboardEntry[]> {
  return (await getRankingStats(rankingId))
    .sort(
      (a, b) =>
        b.entry.likeScore - a.entry.likeScore ||
        a.addedAt.localeCompare(b.addedAt)
    )
    .map((r) => r.entry);
}

// Most Supported: sorted ONLY by real paid Support Credits received,
// descending. Never mixed with Likes. Unchanged by the seed-score model.
export async function getMostSupported(rankingId: string): Promise<LeaderboardEntry[]> {
  return (await getRankingStats(rankingId))
    .sort(
      (a, b) =>
        b.entry.supportScore - a.entry.supportScore ||
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
        b.entry.likeScore - a.entry.likeScore ||
        a.addedAt.localeCompare(b.addedAt)
    )
    .map((r) => r.entry);
  const mostSupported = [...stats]
    .sort(
      (a, b) =>
        b.entry.supportScore - a.entry.supportScore ||
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

// Phase 5.2 (Support Story): credits total of the current #10 on Most
// Supported — the "Top 10 threshold" behind support-page gap copy like
// "140 Credits behind the current Top 10". Null when the ranking has
// fewer than 10 nominees. Ordering mirrors getMostSupported (credits
// DESC, earliest-added first) so the gap agrees with the public board.
// Credits-only by construction: never fiat, never supporter counts.
export async function getTop10CreditsThreshold(
  rankingId: string
): Promise<number | null> {
  const row = (await db
    .prepare(
      `SELECT COALESCE(SUM(ct.credits), 0) AS total
       FROM profiles p
       LEFT JOIN credit_transactions ct
         ON ct.profile_id = p.id AND ct.ranking_id = p.ranking_id
       WHERE p.ranking_id = ? AND p.deleted_at IS NULL
       GROUP BY p.id
       ORDER BY total DESC, p.created_at ASC
       LIMIT 1 OFFSET 9`
    )
    .get(rankingId)) as unknown as { total: number } | undefined;
  return row ? row.total : null;
}

// Phase 5.2 (Support Story): Support Credits a nominee received in the
// last `days` days — the only honest "rising" signal available before
// Phase 3's milestone/discovery labels exist. Refunded payments
// contribute 0 (same convention as the board totals); synthetic seed
// accounts are excluded like everywhere else. Returns 0 when quiet,
// in which case the caller omits the rising line entirely (no event,
// no render — never fabricated).
export async function getRecentCreditsMomentum(
  rankingId: string,
  profileId: string,
  days = 7
): Promise<number> {
  const row = (await db
    .prepare(
      `SELECT COALESCE(SUM(ct.credits), 0) AS total
       FROM credit_transactions ct
       JOIN users u ON u.id = ct.supporter_user_id
       WHERE ct.ranking_id = ? AND ct.profile_id = ?
         AND ct.created_at >= datetime('now', '-' || ? || ' days')
         AND ${seedAccountExclusion("u")}`
    )
    .get(rankingId, profileId, days)) as unknown as { total: number } | undefined;
  return row?.total ?? 0;
}
