// Data helpers for the redesigned category page
// (src/app/rankings/page.tsx, ?category=<slug> view).
// Read-only. Honours the public-read convention
// (rankings: is_hidden = 0 AND deleted_at IS NULL AND not archived;
// profiles: deleted_at IS NULL).
//
// Engagement honesty rules (same as homepage):
// - Displayed vote totals = seed + organic combined.
// - Trending velocity = organic-only (seed likes never trigger Trending).

import { db } from "./client";
import { authenticLikesClause } from "./visibility";
import { toRanking as rowToRanking, type RankingRow } from "./rankings";
import type { Ranking } from "@/lib/types";

const PUBLIC_WHERE =
  "is_hidden = 0 AND deleted_at IS NULL AND COALESCE(is_archived, 0) = 0";

export interface CategoryRankingStat {
  ranking: Ranking;
  // Public ORGANIC Like total — the only number ever rendered as "Likes".
  organicLikeCount: number;
  nomineeCount: number;
  /** Organic-only 7-day velocity (likes7d + credits7d); drives Trending. */
  velocity: number;
  topNomineeName: string;
  topNomineePhoto: string;
  topNomineeColor: string;
}

interface StatRow extends RankingRow {
  total_likes: number;
  nominee_count: number;
  likes7d: number;
  credits7d: number;
}
// total_likes above is ORGANIC ONLY (like_source = 'organic') — the
// like-data contract (方案C 2026-10-01) forbids mixing seed into any
// displayed number.

// One query for the rankings; a second batched query for the top nominee
// per ranking (cover fallback). No per-ranking query fan-out.
export async function listCategoryRankingsWithStats(
  categoryId: string
): Promise<CategoryRankingStat[]> {
  const rows = (await db
    .prepare(
      `SELECT r.*,
         (SELECT COALESCE(SUM(l.count), 0) FROM likes l WHERE l.ranking_id = r.id AND l.like_source = 'organic') AS total_likes,
         (SELECT COUNT(*) FROM profiles p WHERE p.ranking_id = r.id AND p.deleted_at IS NULL) AS nominee_count,
         (SELECT COALESCE(SUM(l.count), 0) FROM likes l
            WHERE l.ranking_id = r.id AND l.created_at >= datetime('now', '-7 days')
            AND ${authenticLikesClause("l")}) AS likes7d,
         (SELECT COALESCE(SUM(ct.credits), 0) FROM credit_transactions ct
            WHERE ct.ranking_id = r.id AND ct.created_at >= datetime('now', '-7 days')) AS credits7d
       FROM rankings r
       WHERE r.category_id = ? AND r.${PUBLIC_WHERE}
       ORDER BY r.created_at DESC`
    )
    .all(categoryId)) as unknown as StatRow[];

  const ids = rows.map((r) => r.id);
  const topByRanking = new Map<
    string,
    { name: string; photo_url: string; avatar_color: string }
  >();
  if (ids.length > 0) {
    const placeholders = ids.map(() => "?").join(",");
    const nominees = (await db
      .prepare(
        `SELECT p.ranking_id, p.name, p.photo_url, p.avatar_color,
           (SELECT COALESCE(SUM(l.count), 0) FROM likes l WHERE l.profile_id = p.id) AS like_count,
           p.created_at
         FROM profiles p
         WHERE p.ranking_id IN (${placeholders}) AND p.deleted_at IS NULL`
      )
      .all(...ids)) as unknown as {
      ranking_id: string;
      name: string;
      photo_url: string;
      avatar_color: string;
      like_count: number;
      created_at: string;
    }[];
    const best = new Map<
      string,
      { like_count: number; created_at: string; row: (typeof nominees)[number] }
    >();
    for (const n of nominees) {
      const cur = best.get(n.ranking_id);
      if (
        !cur ||
        n.like_count > cur.like_count ||
        (n.like_count === cur.like_count && n.created_at < cur.created_at)
      ) {
        best.set(n.ranking_id, { like_count: n.like_count, created_at: n.created_at, row: n });
      }
    }
    for (const [rankingId, b] of best) {
      topByRanking.set(rankingId, {
        name: b.row.name,
        photo_url: b.row.photo_url,
        avatar_color: b.row.avatar_color,
      });
    }
  }

  return rows.map((r) => {
    const top = topByRanking.get(r.id);
    return {
      ranking: rowToRanking(r),
      organicLikeCount: r.total_likes,
      nomineeCount: r.nominee_count,
      velocity: r.likes7d + r.credits7d,
      topNomineeName: top?.name ?? "",
      topNomineePhoto: top?.photo_url ?? "",
      topNomineeColor: top?.avatar_color ?? "",
    };
  });
}

// Trending pick: organic velocity first (honest signal). If fewer than
// `limit` rankings have any velocity, fill the remaining slots with the
// most-voted rankings (displayed totals) — deterministic, never invented.
// Mirrors the homepage's listFeaturedRankings fallback pattern.
export function pickTrending(
  stats: CategoryRankingStat[],
  limit = 3
): CategoryRankingStat[] {
  const byVelocity = [...stats].sort(
    (a, b) => b.velocity - a.velocity || b.organicLikeCount - a.organicLikeCount
  );
  const hot = byVelocity.filter((s) => s.velocity > 0).slice(0, limit);
  if (hot.length >= limit) return hot;
  const picked = new Set(hot.map((s) => s.ranking.id));
  const fill = [...stats]
    .filter((s) => !picked.has(s.ranking.id))
    .sort((a, b) => b.organicLikeCount - a.organicLikeCount || b.nomineeCount - a.nomineeCount)
    .slice(0, limit - hot.length);
  return [...hot, ...fill];
}

export interface SubcategoryWithCount {
  id: string;
  name: string;
  slug: string;
  count: number;
}

// Subcategories of a category that actually contain public rankings,
// with counts — drives the filter-chip row. Chips with no data are
// omitted rather than rendered dead.
export async function listSubcategoriesWithCounts(
  categoryId: string
): Promise<SubcategoryWithCount[]> {
  const rows = (await db
    .prepare(
      `SELECT s.id, s.name, s.slug,
         (SELECT COUNT(*) FROM rankings r
            WHERE r.subcategory_id = s.id AND r.${PUBLIC_WHERE}) AS count
       FROM subcategories s
       WHERE s.category_id = ?
       ORDER BY s.sort_order ASC, s.name ASC`
    )
    .all(categoryId)) as unknown as {
    id: string;
    name: string;
    slug: string;
    count: number;
  }[];
  return rows
    .filter((r) => r.count > 0)
    .map((r) => ({ id: r.id, name: r.name, slug: r.slug, count: r.count }));
}

// 2400 -> "2.4K", 126 -> "126", 48300 -> "48.3K".
export function formatCompact(n: number): string {
  if (n < 1000) return String(n);
  const v = n / 1000;
  const rounded = v >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
  return `${rounded}K`;
}
