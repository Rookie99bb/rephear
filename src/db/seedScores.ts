// Transparent cold-start seed scores (2026-09-30).
//
// A seed_score row is honest metadata, not a fake Like: a small ranking
// weight with a recorded value, reason, author/method, creation time and
// decay rule. Seed scores NEVER enter the likes table, NEVER create fake
// users/like events/comments/timestamps, and are NEVER displayed as user
// Likes ("N likes" always means real organic likes). They only influence
// cold-start ordering until real engagement takes over.
//
// Decay contract (any of these zeroes the effective score):
// - 30 days elapsed since created_at (linear-30d; half-life-14d halves
//   every 14 days instead; none disables time decay),
// - organicLikeCount >= organic_like_threshold (default 50),
// - distinct organic likers >= organic_liker_threshold (default 25).
// No randomness anywhere: identical inputs always produce identical scores.
import { db } from "./client";
import { newId } from "@/lib/id";

export type SeedDecayRule = "linear-30d" | "half-life-14d" | "none";

export interface SeedScoreRow {
  id: string;
  ranking_id: string;
  profile_id: string;
  score: number;
  reason: string;
  created_at: string;
  created_by: string;
  decay_rule: string;
  organic_like_threshold: number;
  organic_liker_threshold: number;
  superseded_at: string | null;
}

export interface SetSeedScoreInput {
  rankingId: string;
  profileId: string;
  score: number;
  reason: string;
  createdBy: string; // 'admin:<user-id>' | 'system:<method>' — who/what set it
  decayRule?: SeedDecayRule;
  organicLikeThreshold?: number;
  organicLikerThreshold?: number;
}

const DECAY_RULES: SeedDecayRule[] = ["linear-30d", "half-life-14d", "none"];

/** Days between two timestamps; unparseable input counts as 0 (full weight). */
export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.max(0, (to - from) / 86_400_000);
}

function timeFactor(decayRule: string, daysElapsed: number): number {
  switch (decayRule) {
    case "half-life-14d":
      return Math.pow(0.5, daysElapsed / 14);
    case "none":
      return 1;
    case "linear-30d":
    default:
      return Math.max(0, 1 - daysElapsed / 30);
  }
}

/**
 * Effective seed score for one row right now. Pure function — the same
 * inputs always give the same output (no randomness in ranking).
 */
export function effectiveSeedScore(
  row: Pick<
    SeedScoreRow,
    | "score"
    | "created_at"
    | "decay_rule"
    | "organic_like_threshold"
    | "organic_liker_threshold"
    | "superseded_at"
  >,
  organicLikeCount: number,
  distinctOrganicLikers: number,
  nowIso: string = new Date().toISOString()
): number {
  if (row.superseded_at) return 0;
  if (organicLikeCount >= row.organic_like_threshold) return 0;
  if (distinctOrganicLikers >= row.organic_liker_threshold) return 0;
  const days = daysBetween(row.created_at, nowIso);
  const f = timeFactor(row.decay_rule, days);
  const v = row.score * f;
  return v > 0 ? v : 0;
}

/** Active (non-superseded) seed scores for a ranking. */
export async function getActiveSeedScores(
  rankingId: string
): Promise<SeedScoreRow[]> {
  const rows = (await db
    .prepare(
      `SELECT * FROM seed_scores
       WHERE ranking_id = ? AND superseded_at IS NULL`
    )
    .all(rankingId)) as unknown as SeedScoreRow[];
  return rows;
}

/**
 * Record (or replace) a seed score. Idempotent: the partial unique index
 * uq_seed_scores_active (ranking_id, profile_id WHERE superseded_at IS
 * NULL) means re-running the same input replaces the active row instead
 * of duplicating it; the old row is preserved with superseded_at.
 */
export async function setSeedScore(input: SetSeedScoreInput): Promise<SeedScoreRow> {
  const decayRule: SeedDecayRule = input.decayRule ?? "linear-30d";
  if (!DECAY_RULES.includes(decayRule)) {
    throw new Error(`decay_rule must be one of ${DECAY_RULES.join(", ")}`);
  }
  if (!Number.isFinite(input.score) || input.score < 0 || input.score > 100) {
    throw new Error("score must be between 0 and 100");
  }
  if (!input.reason.trim()) throw new Error("reason is required");
  if (!input.createdBy.trim()) throw new Error("createdBy is required");

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  // Preserve history: mark the previous active row superseded.
  await db
    .prepare(
      `UPDATE seed_scores SET superseded_at = ?
       WHERE ranking_id = ? AND profile_id = ? AND superseded_at IS NULL`
    )
    .run(now, input.rankingId, input.profileId);

  const row: SeedScoreRow = {
    id: newId(),
    ranking_id: input.rankingId,
    profile_id: input.profileId,
    score: input.score,
    reason: input.reason.trim(),
    created_at: now,
    created_by: input.createdBy.trim(),
    decay_rule: decayRule,
    organic_like_threshold: input.organicLikeThreshold ?? 50,
    organic_liker_threshold: input.organicLikerThreshold ?? 25,
    superseded_at: null,
  };
  await db
    .prepare(
      `INSERT INTO seed_scores
         (id, ranking_id, profile_id, score, reason, created_at, created_by,
          decay_rule, organic_like_threshold, organic_liker_threshold, superseded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
    )
    .run(
      row.id,
      row.ranking_id,
      row.profile_id,
      row.score,
      row.reason,
      row.created_at,
      row.created_by,
      row.decay_rule,
      row.organic_like_threshold,
      row.organic_liker_threshold
    );
  return row;
}

/** Remove a seed score (marks superseded; history preserved). */
export async function clearSeedScore(
  rankingId: string,
  profileId: string
): Promise<void> {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  await db
    .prepare(
      `UPDATE seed_scores SET superseded_at = ?
       WHERE ranking_id = ? AND profile_id = ? AND superseded_at IS NULL`
    )
    .run(now, rankingId, profileId);
}
