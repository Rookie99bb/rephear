import { db } from "./client";
import { authenticLikesClause } from "./visibility";
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
                  AND l.created_at >= datetime('now', '-7 days')
                  AND ${authenticLikesClause("l")}) AS likes_7d,
              (SELECT COUNT(*) FROM credit_transactions ct
                WHERE ct.ranking_id = r.id
                  AND ct.created_at >= datetime('now', '-7 days')
                  AND ct.credits > 0) AS supports_7d
       FROM rankings r
       WHERE r.deleted_at IS NULL AND r.is_hidden = 0 AND COALESCE(r.is_archived, 0) = 0
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

// Most-active rankings by ALL-TIME real activity (likes + valid
// positive credit transactions). Used as the second priority tier in
// the weekly cover refresh: Rising -> most active -> new -> rest.
export async function getMostActiveRankings(limit = 24): Promise<Ranking[]> {
  const rows = (await db
    .prepare(
      `SELECT r.*,
              (SELECT COUNT(*) FROM likes l
                WHERE l.ranking_id = r.id AND ${authenticLikesClause("l")}) AS likes_all,
              (SELECT COUNT(*) FROM credit_transactions ct
                WHERE ct.ranking_id = r.id AND ct.credits > 0) AS supports_all
       FROM rankings r
       WHERE r.deleted_at IS NULL AND r.is_hidden = 0 AND COALESCE(r.is_archived, 0) = 0
       ORDER BY (likes_all + supports_all) DESC
       LIMIT ?`
    )
    .all(limit * 3)) as unknown as (RankingRow & {
    likes_all: number;
    supports_all: number;
  })[];
  return rows
    .filter((r) => r.likes_all + r.supports_all > 0)
    .slice(0, limit)
    .map(toRanking);
}

// Rankings created in the last 30 days (excludes hidden/deleted).
export async function getNewRankings(limit = 6): Promise<Ranking[]> {  const rows = (await db
    .prepare(
      `SELECT * FROM rankings
       WHERE deleted_at IS NULL AND is_hidden = 0 AND COALESCE(is_archived, 0) = 0
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

// Underrated Gems — transparent rule, real engagement only:
//   1. like_count counts ONLY authentic likes (seed_community_* rows are
//      excluded via authenticLikesClause), so "has traction" means real
//      people actually tapped Like.
//   2. reputation_credits < 1000 (under ~£100/$100 of backing) defines
//      "under-supported": the community loves them but nobody has backed
//      them with real money yet.
//   3. Ordered by authentic like_count DESC — the most-loved among the
//      under-supported surface first. No hidden weighting, no arbitrary
//      recency or velocity factor.
export async function getUnderratedNominees(
  limit = 6
): Promise<UnderratedNominee[]> {
  const rows = (await db
    .prepare(
      `SELECT p.*,
              r.id AS ranking_id,
              r.title AS ranking_title,
              (SELECT COALESCE(SUM(l.count), 0) FROM likes l
                WHERE l.ranking_id = p.ranking_id AND l.profile_id = p.id AND ${authenticLikesClause("l")}) AS like_count,
              (SELECT COALESCE(SUM(ct.credits), 0) FROM credit_transactions ct
                WHERE ct.ranking_id = p.ranking_id AND ct.profile_id = p.id) AS reputation_credits
       FROM profiles p
       JOIN rankings r ON r.id = p.ranking_id
       WHERE p.deleted_at IS NULL
         AND r.deleted_at IS NULL AND r.is_hidden = 0 AND COALESCE(r.is_archived, 0) = 0
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

// Rankings with the most all-time likes (for the "Most Loved" card
// badge). Data-backed only — callers decide the cutoff.
export async function getMostLovedRankingIds(limit = 8): Promise<string[]> {
  const rows = (await db
    .prepare(
      `SELECT l.ranking_id AS ranking_id, COALESCE(SUM(l.count), 0) AS n
       FROM likes l
       JOIN rankings r ON r.id = l.ranking_id
       WHERE r.deleted_at IS NULL AND r.is_hidden = 0 AND ${authenticLikesClause("l")} AND COALESCE(r.is_archived, 0) = 0
       GROUP BY l.ranking_id
       HAVING n > 0
       ORDER BY n DESC
       LIMIT ?`
    )
    .all(limit)) as unknown as { ranking_id: string; n: number }[];
  return rows.map((r) => r.ranking_id);
}
