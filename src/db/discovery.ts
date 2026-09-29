import { db } from "./client";
import { toRanking, type RankingRow } from "./rankings";
import { toProfile, type ProfileRow } from "./profiles";
import type { Ranking, Profile } from "@/lib/types";

// Phase 3 (§22): discovery surfaces. All time-bucketed from existing
// created_at columns — no schema change needed for velocity. Sections
// render ONLY when backed by real data (empty result = section hidden,
// never placeholder content).

export interface RisingRanking {
  ranking: Ranking;
  likes7d: number;
  supports7d: number;
  score: number;
}

// Rankings with the most like + paid-support activity in the last 7
// days. Score = likes + supports (each support = one conviction signal;
// no credit-amount weighting — velocity measures attention, not spend).
export async function getRisingRankings(
  limit = 6
): Promise<RisingRanking[]> {
  const rows = (await db
    .prepare(
      `SELECT r.*,
              (SELECT COUNT(*) FROM likes l
                WHERE l.ranking_id = r.id
                  AND l.created_at >= datetime('now', '-7 days')) AS likes_7d,
              (SELECT COUNT(*) FROM credit_transactions ct
                WHERE ct.ranking_id = r.id
                  AND ct.created_at >= datetime('now', '-7 days')
                  AND ct.credits > 0) AS supports_7d
       FROM rankings r
       WHERE r.deleted_at IS NULL AND r.is_hidden = 0
       ORDER BY (likes_7d + supports_7d) DESC
       LIMIT ?`
    )
    .all(limit * 3)) as unknown as (RankingRow & {
    likes_7d: number;
    supports_7d: number;
  })[];
  return rows
    .map((r) => ({
      ranking: toRanking(r),
      likes7d: r.likes_7d,
      supports7d: r.supports_7d,
      score: r.likes_7d + r.supports_7d,
    }))
    .filter((r) => r.score > 0)
    .slice(0, limit);
}

// Rankings created in the last 30 days (excludes hidden/deleted).
export async function getNewRankings(limit = 6): Promise<Ranking[]> {
  const rows = (await db
    .prepare(
      `SELECT * FROM rankings
       WHERE deleted_at IS NULL AND is_hidden = 0
         AND created_at >= datetime('now', '-30 days')
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(limit)) as unknown as RankingRow[];
  return rows.map(toRanking);
}

export interface UnderratedNominee {
  profile: Profile;
  rankingId: string;
  rankingTitle: string;
  likeCount: number;
  reputationCredits: number;
}

// Nominees under 1,000 credits with real like traction — the
// "deserves more recognition" set. Sorted by likes, credits-blind.
export async function getUnderratedNominees(
  limit = 6
): Promise<UnderratedNominee[]> {
  const rows = (await db
    .prepare(
      `SELECT p.*,
              r.id AS ranking_id,
              r.title AS ranking_title,
              (SELECT COALESCE(SUM(l.count), 0) FROM likes l
                WHERE l.ranking_id = p.ranking_id AND l.profile_id = p.id) AS like_count,
              (SELECT COALESCE(SUM(ct.credits), 0) FROM credit_transactions ct
                WHERE ct.ranking_id = p.ranking_id AND ct.profile_id = p.id) AS reputation_credits
       FROM profiles p
       JOIN rankings r ON r.id = p.ranking_id
       WHERE p.deleted_at IS NULL
         AND r.deleted_at IS NULL AND r.is_hidden = 0
       GROUP BY p.id
       HAVING reputation_credits < 1000 AND like_count > 0
       ORDER BY like_count DESC
       LIMIT ?`
    )
    .all(limit)) as unknown as (ProfileRow & {
    ranking_id: string;
    ranking_title: string;
    like_count: number;
    reputation_credits: number;
  })[];
  return rows.map((r) => ({
    profile: toProfile(r),
    rankingId: r.ranking_id,
    rankingTitle: r.ranking_title,
    likeCount: r.like_count,
    reputationCredits: r.reputation_credits,
  }));
}
