// Data helpers for the redesigned homepage (src/app/page.tsx).
// Everything here is read-only and honours the public-read convention
// (rankings: is_hidden = 0 AND deleted_at IS NULL; profiles:
// deleted_at IS NULL). Homepage aggregations (SUM of credits / counts of
// likes) are privacy-safe by construction: they never expose per-supporter
// identities or private-support counts.

import { db } from "./client";
import { authenticLikesClause } from "./visibility";
import { getManualCuratedRankings } from "./curation";
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

/* ---------------- Rising Now (cold-start aware) ---------------- */

import {
  COLD_START_CATEGORY_PRIORITY,
  COLD_START_SEED_BY_SLUG,
  COLD_START_SEED_VALUES,
  isRisingColdStartEnabled,
} from "@/config/risingColdStart";

export interface RisingNowRow {
  ranking: Ranking;
  /** Genuine organic likes in the last 7 days (never touched by seed). */
  organicLikes7d: number;
  /** Cold-start seed likes shown on top of organic. 0 when cold-start is off. */
  seedLikes7d: number;
  /** Public displayed number: organic + seed (or organic-only when off). */
  displayLikes7d: number;
  credits7d: number;
  likesPrev7d: number;
}

interface CandidateRow extends RankingRow {
  category_slug: string | null;
  total_likes: number;
}

/** Deterministic pool of public ACG rankings with at least one nominee. */
async function listColdStartCandidates(): Promise<Ranking[]> {
  const rows = await db
    .prepare(
      `SELECT r.*, c.slug AS category_slug,
              (SELECT COALESCE(SUM(l.count), 0) FROM likes l WHERE l.ranking_id = r.id) AS total_likes
       FROM rankings r
       LEFT JOIN categories c ON c.id = r.category_id
       WHERE r.${PUBLIC_WHERE}
         AND EXISTS (
           SELECT 1 FROM profiles p
           WHERE p.ranking_id = r.id AND p.deleted_at IS NULL
         )
       ORDER BY total_likes DESC, r.created_at DESC, r.id ASC
       LIMIT 60`,
    )
    .all();
  return (rows as CandidateRow[]).map((r) => ({
    ...rowToRanking(r as unknown as RankingRow),
    // stash category slug for diversity picking (not part of public type)
    __categorySlug: r.category_slug,
  })) as Ranking[];
}

type RankedWithCat = Ranking & { __categorySlug?: string | null };

function pickDiverse(candidates: RankedWithCat[], limit: number): RankedWithCat[] {
  const groups = new Map<string, RankedWithCat[]>();
  for (const c of candidates) {
    const key = c.__categorySlug ?? "other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }
  const otherCats: string[] = [];
  for (const key of groups.keys()) {
    if (!COLD_START_CATEGORY_PRIORITY.includes(key)) otherCats.push(key);
  }
  const catOrder = [...COLD_START_CATEGORY_PRIORITY, ...otherCats];
  const picked: RankedWithCat[] = [];
  for (let round = 0; picked.length < limit; round++) {
    let progressed = false;
    for (const cat of catOrder) {
      const g = groups.get(cat);
      if (g && g.length > 0 && picked.length < limit) {
        picked.push(g.shift()!);
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return picked;
}

async function organicStats(ids: string[]): Promise<{
  cur: Map<string, number>;
  prev: Map<string, number>;
  credits: Map<string, number>;
}> {
  const cur = new Map<string, number>();
  const prev = new Map<string, number>();
  const credits = new Map<string, number>();
  if (ids.length === 0) return { cur, prev, credits };
  const placeholders = ids.map(() => "?").join(",");
  const likeClause = authenticLikesClause("l");
  const curRows = (await db
    .prepare(
      `SELECT l.ranking_id AS ranking_id, COALESCE(SUM(l.count), 0) AS n
       FROM likes l
       WHERE l.ranking_id IN (${placeholders})
         AND l.created_at >= datetime('now', '-7 days')
         AND ${likeClause}
       GROUP BY l.ranking_id`,
    )
    .all(...ids)) as { ranking_id: string; n: number }[];
  for (const r of curRows) cur.set(r.ranking_id, r.n);
  const prevRows = (await db
    .prepare(
      `SELECT l.ranking_id AS ranking_id, COALESCE(SUM(l.count), 0) AS n
       FROM likes l
       WHERE l.ranking_id IN (${placeholders})
         AND l.created_at >= datetime('now', '-14 days')
         AND l.created_at < datetime('now', '-7 days')
         AND ${likeClause}
       GROUP BY l.ranking_id`,
    )
    .all(...ids)) as { ranking_id: string; n: number }[];
  for (const r of prevRows) prev.set(r.ranking_id, r.n);
  const creditRows = (await db
    .prepare(
      `SELECT ct.ranking_id AS ranking_id, COALESCE(SUM(ct.credits), 0) AS n
       FROM credit_transactions ct
       WHERE ct.ranking_id IN (${placeholders})
         AND ct.created_at >= datetime('now', '-7 days')
       GROUP BY ct.ranking_id`,
    )
    .all(...ids)) as { ranking_id: string; n: number }[];
  for (const r of creditRows) credits.set(r.ranking_id, r.n);
  return { cur, prev, credits };
}

/**
 * Build RisingNowRow values for an explicit, ordered list of rankings.
 * Manual picks and automatic picks share the exact same stats pipeline,
 * so a curated ranking is never displayed differently from an organic one
 * (cold-start seed applies by slug exactly as it does for auto picks).
 */
async function toRisingRows(rankings: Ranking[]): Promise<RisingNowRow[]> {
  if (rankings.length === 0) return [];
  const coldStart = isRisingColdStartEnabled();
  const ids = rankings.map((r) => r.id);
  const { cur, prev, credits } = await organicStats(ids);
  return rankings.map((p, i) => {
    const seed = coldStart
      ? ((p.slug ? COLD_START_SEED_BY_SLUG[p.slug] : undefined) ??
        COLD_START_SEED_VALUES[i % COLD_START_SEED_VALUES.length])
      : 0;
    const organic = cur.get(p.id) ?? 0;
    return {
      ranking: p,
      organicLikes7d: organic,
      seedLikes7d: seed,
      displayLikes7d: organic + seed,
      credits7d: credits.get(p.id) ?? 0,
      likesPrev7d: prev.get(p.id) ?? 0,
    };
  });
}

/**
 * Rising Now rows — manual-first.
 *
 * Admin-curated picks (see src/db/curation.ts) occupy the first slots in
 * position order; the automatic logic fills whatever slots remain, never
 * duplicating a curated ranking. With no manual picks the behaviour is
 * exactly what it was before.
 *
 * Cold-start ON:  ~6 ACG-diverse public rankings, display value =
 * organic_weekly_likes + seed_weekly_likes (seed from config, stable,
 * never random). Organic data is untouched and stays distinguishable.
 *
 * Cold-start OFF: organic-only velocity, same as before.
 */
export async function listRisingNow(limit = 6): Promise<RisingNowRow[]> {
  const manual = (await getManualCuratedRankings("rising")).slice(0, limit);
  const remaining = limit - manual.length;
  if (remaining <= 0) return toRisingRows(manual);
  const manualIds = new Set(manual.map((r) => r.id));

  let auto: Ranking[];
  if (!isRisingColdStartEnabled()) {
    const velocity = await listVelocityRankings(limit + manualIds.size);
    auto = velocity
      .filter((v) => !manualIds.has(v.ranking.id))
      .slice(0, remaining)
      .map((v) => v.ranking);
  } else {
    const candidates = (await listColdStartCandidates()).filter(
      (c) => !manualIds.has(c.id),
    );
    auto = pickDiverse(candidates as RankedWithCat[], remaining);
  }
  const [manualRows, autoRows] = await Promise.all([
    toRisingRows(manual),
    toRisingRows(auto),
  ]);
  // Manual picks keep admin position order; auto picks keep their
  // natural order behind them (velocity order when cold-start is off,
  // display order when it is on — exactly as before, no behaviour change
  // when nothing is curated).
  if (isRisingColdStartEnabled()) {
    autoRows.sort((a, b) => b.displayLikes7d - a.displayLikes7d);
  }
  return [...manualRows, ...autoRows];
}

/** Re-export for the homepage (keeps the old flag name working too). */
export { isRisingColdStartEnabled };
