// Data helpers for the redesigned homepage (src/app/page.tsx).
// Everything here is read-only and honours the public-read convention
// (rankings: is_hidden = 0 AND deleted_at IS NULL; profiles:
// deleted_at IS NULL). Homepage aggregations (SUM of credits / counts of
// likes) are privacy-safe by construction: they never expose per-supporter
// identities or private-support counts.

import { db } from "./client";
import { authenticLikesClause } from "./visibility";
import { findCategoryById, findCategoryBySlug } from "./categories";
import { getMostSupported } from "./leaderboards";
import { toProfile, type ProfileRow } from "./profiles";
import type { Profile, Ranking } from "@/lib/types";

const PUBLIC_WHERE = "is_hidden = 0 AND deleted_at IS NULL AND COALESCE(is_archived, 0) = 0";

interface StatsRow extends ProfileRow {
  like_count: number;
  reputation_credits: number;
}

// Ranking rows come from SELECT r.* queries, so the shared RankingRow
// shape (incl. cover columns) applies — reuse toRanking from
// db/rankings.ts as the single mapping.
import { toRanking as rowToRanking, type RankingRow } from "./rankings";

export interface RankingCardData {
  nomineeCount: number;
  totalLikes: number;
  totalCredits: number;
  // Top nominees by likes, for the avatar strip and the cover photo.
  topNominees: Profile[];
  topLikeCounts: number[];
}

// One query per ranking: nominee count, total likes, total credits and
// the top-5 nominees by likes (avatar strip + cover photo source).
export async function getRankingCardData(
  rankingId: string
): Promise<RankingCardData> {
  const rows = (await db
    .prepare(
      `SELECT p.*,
         (SELECT COALESCE(SUM(l.count), 0) FROM likes l WHERE l.ranking_id = ? AND l.profile_id = p.id) AS like_count,
         (SELECT COALESCE(SUM(ct.credits), 0) FROM credit_transactions ct WHERE ct.ranking_id = ? AND ct.profile_id = p.id) AS reputation_credits
       FROM profiles p
       WHERE p.ranking_id = ? AND p.deleted_at IS NULL
       ORDER BY like_count DESC, p.created_at ASC`
    )
    .all(rankingId, rankingId, rankingId)) as unknown as StatsRow[];
  return {
    nomineeCount: rows.length,
    totalLikes: rows.reduce((s, r) => s + r.like_count, 0),
    totalCredits: rows.reduce((s, r) => s + r.reputation_credits, 0),
    topNominees: rows.slice(0, 5).map((r) => toProfile(r)),
    topLikeCounts: rows.slice(0, 5).map((r) => r.like_count),
  };
}

export async function getCategoryNameForRanking(
  ranking: Ranking
): Promise<string | null> {
  if (!ranking.categoryId) return null;
  const category = await findCategoryById(ranking.categoryId);
  return category?.name ?? null;
}

// "Global" vs city label for card badges. Curated global rankings store
// an empty/"Global" city; everything else shows its city.
export function locationLabelFor(ranking: Ranking): string {
  const city = (ranking.city ?? "").trim();
  if (!city || city.toLowerCase() === "global") return "Global";
  return city;
}

export interface WeeklyVelocity {
  rankingId: string;
  likes7d: number;
  credits7d: number;
  // Organic likes in the 7 days BEFORE the current 7-day window, for the
  // optional "↑ XX% this week" momentum badge. Zero → badge omitted
  // (never divide by zero, never invent a baseline).
  likesPrev7d: number;
}

export interface VelocityRanking extends WeeklyVelocity {
  ranking: Ranking;
}

// Honest "Rising Now" signal: likes + support credits created in the
// last 7 days, per public ranking. The full public ranking row comes back
// with the aggregates so callers never need an unfiltered lookup (every
// public read enforces is_hidden = 0 AND deleted_at IS NULL by itself).
// There is no ranking-history table, so position deltas ("+N positions")
// are impossible — velocity is what the data can truthfully say.
export async function listVelocityRankings(
  limit: number
): Promise<VelocityRanking[]> {
  const rows = (await db
    .prepare(
      `SELECT r.*,
         (SELECT COALESCE(SUM(l.count), 0) FROM likes l
            WHERE l.ranking_id = r.id AND l.created_at >= datetime('now', '-7 days') AND ${authenticLikesClause("l")}) AS likes7d,
         (SELECT COALESCE(SUM(l.count), 0) FROM likes l
            WHERE l.ranking_id = r.id AND l.created_at >= datetime('now', '-14 days') AND l.created_at < datetime('now', '-7 days') AND ${authenticLikesClause("l")}) AS likesPrev7d,
         (SELECT COALESCE(SUM(ct.credits), 0) FROM credit_transactions ct
            WHERE ct.ranking_id = r.id AND ct.created_at >= datetime('now', '-7 days')) AS credits7d
       FROM rankings r
       WHERE r.${PUBLIC_WHERE}
       ORDER BY (likes7d + credits7d) DESC, r.created_at DESC
       LIMIT ?`
    )
    .all(limit)) as unknown as (RankingRow & {
    likes7d: number;
    credits7d: number;
    likesPrev7d: number;
  })[];
  return rows
    .filter((r) => r.likes7d + r.credits7d > 0)
    .map((r) => ({
      rankingId: r.id,
      likes7d: r.likes7d,
      credits7d: r.credits7d,
      likesPrev7d: r.likesPrev7d,
      ranking: rowToRanking(r),
    }));
}

// Backwards-compatible ID-only view of listVelocityRankings.
export async function getWeeklyVelocity(
  limit: number
): Promise<WeeklyVelocity[]> {
  return (await listVelocityRankings(limit)).map(({ rankingId, likes7d, credits7d, likesPrev7d }) => ({
    rankingId,
    likes7d,
    credits7d,
    likesPrev7d,
  }));
}

// Featured fallback for the homepage trending section: the section must
// always render 3 cards, but real Trending is organic-only and may yield
// fewer than 3 (or zero). This fills the remaining slots with public,
// populated rankings in editorial category priority (Anime > Gaming >
// Manga > Cosplay > everything else), ordered by total displayed likes
// (seed + organic may show in public totals — seed only never *triggers*
// a trending/rising signal, it just counts toward a displayed total).
// Deterministic; never invents rankings.
export async function listFeaturedRankings(
  excludeIds: string[],
  limit: number
): Promise<Ranking[]> {
  if (limit <= 0) return [];
  const exclude =
    excludeIds.length > 0
      ? `AND r.id NOT IN (${excludeIds.map(() => "?").join(",")})`
      : "";
  const rows = (await db
    .prepare(
      `SELECT r.*,
         (SELECT COALESCE(SUM(l.count), 0) FROM likes l WHERE l.ranking_id = r.id) AS total_likes,
         CASE c.slug
           WHEN 'anime' THEN 0
           WHEN 'gaming' THEN 1
           WHEN 'manga' THEN 2
           WHEN 'cosplay' THEN 3
           ELSE 4
         END AS cat_prio
       FROM rankings r
       LEFT JOIN categories c ON c.id = r.category_id
       WHERE r.is_hidden = 0 AND r.deleted_at IS NULL AND COALESCE(r.is_archived, 0) = 0
         ${exclude}
         AND EXISTS (
           SELECT 1 FROM profiles p
           WHERE p.ranking_id = r.id AND p.deleted_at IS NULL
         )
       ORDER BY cat_prio ASC, total_likes DESC, r.created_at DESC
       LIMIT ?`
    )
    .all(...excludeIds, limit)) as unknown as (RankingRow & {
    total_likes: number;
    cat_prio: number;
  })[];
  return rows.map((r) => rowToRanking(r));
}

// Public ranking ids for a set of slugs (event deep-links). Every slug
// that does not resolve to a public ranking is simply absent — callers
// must leave the event unlinked rather than invent a route.
export async function findPublicRankingIdsBySlugs(
  slugs: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const slug of slugs) {
    const row = (await db
      .prepare(
        `SELECT id FROM rankings WHERE slug = ? AND ${PUBLIC_WHERE} LIMIT 1`
      )
      .get(slug)) as unknown as { id: string } | undefined;
    if (row) out.set(slug, row.id);
  }
  return out;
}

export interface CloseBattle {
  ranking: Ranking;
  // Top 3 by support credits (parallel to credits[i]).
  top: Profile[];
  credits: number[];
  // #1 credits minus #2 credits — always computed from real ledger sums.
  gap: number;
}

// The tightest real top-2 support-credit race across the given rankings.
// Returns null when no ranking has a genuinely close race, in which case
// the Close Battles module must be hidden rather than faked.
const CLOSE_BATTLE_MAX_GAP = 250;

export async function findCloseBattle(
  rankings: Ranking[]
): Promise<CloseBattle | null> {
  let best: CloseBattle | null = null;
  for (const ranking of rankings) {
    const board = await getMostSupported(ranking.id);
    if (board.length < 2) continue;
    const first = board[0];
    const second = board[1];
    if (first.reputationCredits <= 0 || second.reputationCredits <= 0) continue;
    const gap = first.reputationCredits - second.reputationCredits;
    if (gap < 0) continue;
    if (!best || gap < best.gap) {
      best = {
        ranking,
        top: board.slice(0, 3).map((e) => e.profile),
        credits: board.slice(0, 3).map((e) => e.reputationCredits),
        gap,
      };
    }
  }
  if (!best || best.gap > CLOSE_BATTLE_MAX_GAP) return null;
  return best;
}

export interface ExploreQuery {
  categorySlug?: string;
  city?: string;
  sort: "trending" | "newest";
  limit: number;
}

export interface ExploreRanking {
  ranking: Ranking;
  categoryName: string | null;
  activityScore: number;
}

// Rankings for the Explore module, honouring the homepage filter state
// (category / location / sort) via query params.
export async function listExploreRankings(
  q: ExploreQuery
): Promise<ExploreRanking[]> {
  const category = q.categorySlug
    ? await findCategoryBySlug(q.categorySlug)
    : null;
  const where: string[] = [`r.${PUBLIC_WHERE}`];
  const params: (string | number)[] = [];
  if (category) {
    where.push("r.category_id = ?");
    params.push(category.id);
  } else if (q.categorySlug) {
    // Unknown category slug: no rankings can match.
    return [];
  }
  if (q.city) {
    where.push("r.city = ?");
    params.push(q.city);
  }
  // ACG-first merchandising (soft preference): in the default unfiltered
  // view, ACG categories surface first (Anime > Gaming > Manga >
  // Cosplay), ordered by activity within each tier. Explicit user intent
  // (category/city filter, newest sort) always overrides — we never
  // re-rank filtered results.
  const isDefaultView = !q.categorySlug && !q.city && q.sort !== "newest";
  const orderBy =
    q.sort === "newest"
      ? "r.created_at DESC"
      : isDefaultView
        ? "cat_prio ASC, activity_score DESC, r.created_at DESC"
        : "activity_score DESC, r.created_at DESC";
  const rows = (await db
    .prepare(
      `SELECT r.*,
         (SELECT COUNT(*) FROM likes l WHERE l.ranking_id = r.id) +
         (SELECT COALESCE(SUM(ct.credits), 0) FROM credit_transactions ct WHERE ct.ranking_id = r.id) AS activity_score,
         c.name AS category_name,
         CASE c.slug
           WHEN 'anime' THEN 0
           WHEN 'gaming' THEN 1
           WHEN 'manga' THEN 2
           WHEN 'cosplay' THEN 3
           ELSE 4
         END AS cat_prio
       FROM rankings r
       LEFT JOIN categories c ON c.id = r.category_id
       WHERE ${where.join(" AND ")}
       ORDER BY ${orderBy}
       LIMIT ?`
    )
    .all(...params, q.limit)) as unknown as {
      id: string;
      title: string;
      country: string;
      city: string;
      description: string;
      created_by: string;
      created_at: string;
      is_hidden: number;
      deleted_at: string | null;
      slug: string | null;
      category_id: string | null;
      is_pinned: number;
      display_order: number | null;
      activity_score: number;
      category_name: string | null;
    }[];
  return rows.map((r) => ({
    // Reuse the single row->Ranking mapping so every field (cover
    // columns, taxonomy, flags) stays in sync with db/rankings.ts.
    ranking: rowToRanking(r as unknown as RankingRow),
    categoryName: r.category_name,
    activityScore: r.activity_score,
  }));
}
