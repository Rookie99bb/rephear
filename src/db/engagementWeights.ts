// Engagement weights (Seed Likes Policy, 2026-09-30).
//
// ranking_score = (seed_score × seed_weight) + (organic_score × organic_weight)
//
// Cold-start defaults: seed_weight = 1.0, organic_weight = 1.0 — Most Loved
// may include seed likes. The architecture allows seed influence to decay
// later (1.0 → 0.5 → 0.25 → 0) without deleting any historical seed record;
// organic_weight stays 1.0. Weights are DB-backed so an admin/editorial
// action can adjust them without a deploy.
import { db } from "./client";

export interface LikeWeights {
  seedWeight: number;
  organicWeight: number;
}

const DEFAULTS: LikeWeights = { seedWeight: 1.0, organicWeight: 1.0 };

function toNum(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export async function getLikeWeights(): Promise<LikeWeights> {
  try {
    const rows = (await db
      .prepare("SELECT key, value FROM engagement_config WHERE key IN ('seed_weight','organic_weight')")
      .all()) as unknown as { key: string; value: string }[];
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
      seedWeight: toNum(map.get("seed_weight"), DEFAULTS.seedWeight),
      organicWeight: toNum(map.get("organic_weight"), DEFAULTS.organicWeight),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function setLikeWeights(w: Partial<LikeWeights>): Promise<LikeWeights> {
  if (w.seedWeight !== undefined) {
    if (!Number.isFinite(w.seedWeight) || w.seedWeight < 0 || w.seedWeight > 2)
      throw new Error("seed_weight must be between 0 and 2");
    await db
      .prepare("INSERT INTO engagement_config (key, value, updated_at) VALUES ('seed_weight', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')")
      .run(String(w.seedWeight));
  }
  if (w.organicWeight !== undefined) {
    if (!Number.isFinite(w.organicWeight) || w.organicWeight < 0 || w.organicWeight > 2)
      throw new Error("organic_weight must be between 0 and 2");
    await db
      .prepare("INSERT INTO engagement_config (key, value, updated_at) VALUES ('organic_weight', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')")
      .run(String(w.organicWeight));
  }
  return getLikeWeights();
}

// Weighted combined score for a (seed, organic) pair.
export function weightedLikeScore(seed: number, organic: number, w: LikeWeights): number {
  return seed * w.seedWeight + organic * w.organicWeight;
}
