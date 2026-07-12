import { db } from "./client";
import { newId } from "@/lib/id";
import type { Ranking } from "@/lib/types";

interface RankingRow {
  id: string;
  title: string;
  country: string;
  city: string;
  description: string;
  created_by: string;
  created_at: string;
  is_hidden: number;
  deleted_at: string | null;
}

function toRanking(row: RankingRow): Ranking {
  return {
    id: row.id,
    title: row.title,
    country: row.country,
    city: row.city,
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at,
    isHidden: !!row.is_hidden,
    deletedAt: row.deleted_at,
  };
}

// createdAt is an optional override used only by the demo seed data.
export function createRanking(params: {
  title: string;
  country: string;
  city: string;
  description: string;
  createdBy: string;
  createdAt?: string;
}): Ranking {
  const id = newId();
  db.prepare(
    `INSERT INTO rankings (id, title, country, city, description, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`
  ).run(
    id,
    params.title.trim(),
    params.country.trim(),
    params.city.trim(),
    params.description.trim(),
    params.createdBy,
    params.createdAt ?? null
  );
  return findRankingById(id)!;
}

// Returns a Ranking regardless of hidden/soft-deleted status — used both
// by the public detail page (which itself decides whether to show a
// hidden/deleted Ranking to non-admins) and by the admin moderation panel.
export function findRankingById(id: string): Ranking | null {
  const row = db
    .prepare("SELECT * FROM rankings WHERE id = ?")
    .get(id) as unknown as RankingRow | undefined;
  return row ? toRanking(row) : null;
}

// Every public-facing read excludes both hidden (spam) and soft-deleted
// Rankings. This is the one filter clause repeated below; keep it in sync
// with the schema, not with any query-builder abstraction — there's only
// one table involved and a shared helper wouldn't earn its keep.
const PUBLIC_WHERE = "is_hidden = 0 AND deleted_at IS NULL";

// city is optional — when given (the logged-in user's location), only
// Rankings for that city are returned. Rankings are location-first: the
// homepage and /rankings both default to the current user's city.
export function listNewestRankings(limit = 20, city?: string): Ranking[] {
  const cityClause = city ? "AND city = ?" : "";
  const rows = db
    .prepare(
      `SELECT * FROM rankings WHERE ${PUBLIC_WHERE} ${cityClause} ORDER BY created_at DESC LIMIT ?`
    )
    .all(...(city ? [city, limit] : [limit])) as unknown as RankingRow[];
  return rows.map(toRanking);
}

// "Trending" for the MVP = Rankings with the most combined community
// activity (likes + reputation credits) across all their nominees. No
// separate analytics system needed — it's a derived read.
export function listTrendingRankings(limit = 10, city?: string): Ranking[] {
  const cityClause = city ? "AND r.city = ?" : "";
  const rows = db
    .prepare(
      `SELECT r.*,
        (SELECT COUNT(*) FROM likes l WHERE l.ranking_id = r.id) +
        (SELECT COALESCE(SUM(ct.credits), 0) FROM credit_transactions ct WHERE ct.ranking_id = r.id)
          AS activity_score
       FROM rankings r
       WHERE r.${PUBLIC_WHERE} ${cityClause}
       ORDER BY activity_score DESC, r.created_at DESC
       LIMIT ?`
    )
    .all(...(city ? [city, limit] : [limit])) as unknown as (RankingRow & { activity_score: number })[];
  return rows.map(toRanking);
}

// Same "trending" scoring as listTrendingRankings, but scoped to a whole
// country instead of one city — used for the homepage's "Popular in
// {country}" tier. excludeCity lets the homepage skip Rankings already
// shown in the city-level tier above it, so the two sections don't repeat
// each other.
export function listTrendingRankingsForCountry(
  limit: number,
  country: string,
  excludeCity?: string
): Ranking[] {
  const excludeClause = excludeCity ? "AND r.city != ?" : "";
  const rows = db
    .prepare(
      `SELECT r.*,
        (SELECT COUNT(*) FROM likes l WHERE l.ranking_id = r.id) +
        (SELECT COALESCE(SUM(ct.credits), 0) FROM credit_transactions ct WHERE ct.ranking_id = r.id)
          AS activity_score
       FROM rankings r
       WHERE r.${PUBLIC_WHERE} AND r.country = ? ${excludeClause}
       ORDER BY activity_score DESC, r.created_at DESC
       LIMIT ?`
    )
    .all(
      ...(excludeCity ? [country, excludeCity, limit] : [country, limit])
    ) as unknown as (RankingRow & { activity_score: number })[];
  return rows.map(toRanking);
}

export interface RegionCount {
  country: string;
  city: string;
  rankingCount: number;
}

export function listPopularRegions(limit = 8): RegionCount[] {
  const rows = db
    .prepare(
      `SELECT country, city, COUNT(*) AS ranking_count
       FROM rankings
       WHERE ${PUBLIC_WHERE}
       GROUP BY country, city
       ORDER BY ranking_count DESC
       LIMIT ?`
    )
    .all(limit) as unknown as { country: string; city: string; ranking_count: number }[];
  return rows.map((r) => ({
    country: r.country,
    city: r.city,
    rankingCount: r.ranking_count,
  }));
}

export function listAllRankings(): Ranking[] {
  const rows = db
    .prepare(`SELECT * FROM rankings WHERE ${PUBLIC_WHERE} ORDER BY created_at DESC`)
    .all() as unknown as RankingRow[];
  return rows.map(toRanking);
}

// Unfiltered — includes hidden AND soft-deleted Rankings. Admin
// moderation panel only, so admins can find and restore either.
export function listAllRankingsForAdmin(): Ranking[] {
  const rows = db
    .prepare("SELECT * FROM rankings ORDER BY created_at DESC")
    .all() as unknown as RankingRow[];
  return rows.map(toRanking);
}

export function searchRankingsByRegion(params: {
  country?: string;
  city?: string;
}): Ranking[] {
  const clauses: string[] = [PUBLIC_WHERE];
  const values: string[] = [];
  if (params.country) {
    clauses.push("country = ?");
    values.push(params.country);
  }
  if (params.city) {
    clauses.push("city = ?");
    values.push(params.city);
  }
  const where = `WHERE ${clauses.join(" AND ")}`;
  const rows = db
    .prepare(`SELECT * FROM rankings ${where} ORDER BY created_at DESC`)
    .all(...values) as unknown as RankingRow[];
  return rows.map(toRanking);
}

export function setRankingHidden(id: string, hidden: boolean): void {
  db.prepare("UPDATE rankings SET is_hidden = ? WHERE id = ?").run(
    hidden ? 1 : 0,
    id
  );
}

// Soft delete: marks the Ranking as deleted without touching anything
// else. Nominees, Likes, Payments, and Credit Transactions tied to this
// Ranking are left completely intact — there is no cascade. Restoring
// (below) makes them all visible again immediately, because they were
// never actually removed.
export function softDeleteRanking(id: string): void {
  db.prepare(
    "UPDATE rankings SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL"
  ).run(id);
}

export function restoreRanking(id: string): void {
  db.prepare("UPDATE rankings SET deleted_at = NULL WHERE id = ?").run(id);
}
