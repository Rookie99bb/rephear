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
  slug: string | null;
  category_id: string | null;
  is_pinned: number;
  display_order: number | null;
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
    slug: row.slug,
    categoryId: row.category_id,
    isPinned: !!row.is_pinned,
    // Legacy safety only: every row is backfilled a real value by
    // backfillRankingDisplayOrder() in schema.ts, and createRanking()
    // below always assigns one to new rows, so this fallback should
    // never actually be exercised in practice.
    displayOrder: row.display_order ?? 0,
  };
}

// Used by createRanking() below (every new Ranking gets the next slot
// in its city automatically) and available to callers that need to
// know the current high-water mark for a city without inserting yet.
export async function getNextDisplayOrderForCity(city: string): Promise<number> {
  const row = (await db
    .prepare(
      "SELECT COALESCE(MAX(display_order), 0) as maxOrder FROM rankings WHERE city = ?"
    )
    .get(city.trim())) as unknown as { maxOrder: number } | undefined;
  return (row?.maxOrder ?? 0) + 1;
}

// createdAt is an optional override used only by the demo seed data.
// slug/categoryId are optional overrides used only by curated/editorial
// Ranking sets (see src/db/londonNicheRankings.ts) — ordinary
// community-created Rankings never set either.
export async function createRanking(params: {
  title: string;
  country: string;
  city: string;
  description: string;
  createdBy: string;
  createdAt?: string;
  slug?: string;
  categoryId?: string;
}): Promise<Ranking> {
  const id = newId();
  const city = params.city.trim();
  // Every new Ranking starts unpinned (is_pinned defaults to 0 — see
  // schema.ts) and slots in after every other Ranking already in this
  // city, admin-defined order is never disturbed by new arrivals.
  const displayOrder = await getNextDisplayOrderForCity(city);
  await db
    .prepare(
      `INSERT INTO rankings (id, title, country, city, description, created_by, created_at, slug, category_id, display_order)
     VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?, ?, ?)`
    )
    .run(
      id,
      params.title.trim(),
      params.country.trim(),
      city,
      params.description.trim(),
      params.createdBy,
      params.createdAt ?? null,
      params.slug ?? null,
      params.categoryId ?? null,
      displayOrder
    );
  return (await findRankingById(id))!;
}

// Used by curated seed scripts (see londonNicheRankings.ts) to check
// whether a Ranking already exists before inserting — the idempotency
// guarantee for those seeds is entirely keyed off this lookup.
export async function findRankingBySlug(slug: string): Promise<Ranking | null> {
  const row = (await db
    .prepare("SELECT * FROM rankings WHERE slug = ?")
    .get(slug)) as unknown as RankingRow | undefined;
  return row ? toRanking(row) : null;
}

// Returns a Ranking regardless of hidden/soft-deleted status — used both
// by the public detail page (which itself decides whether to show a
// hidden/deleted Ranking to non-admins) and by the admin moderation panel.
export async function findRankingById(id: string): Promise<Ranking | null> {
  const row = (await db
    .prepare("SELECT * FROM rankings WHERE id = ?")
    .get(id)) as unknown as RankingRow | undefined;
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
export async function listNewestRankings(limit = 20, city?: string): Promise<Ranking[]> {
  const cityClause = city ? "AND city = ?" : "";
  const rows = (await db
    .prepare(
      `SELECT * FROM rankings WHERE ${PUBLIC_WHERE} ${cityClause} ORDER BY created_at DESC LIMIT ?`
    )
    .all(...(city ? [city, limit] : [limit]))) as unknown as RankingRow[];
  return rows.map(toRanking);
}

// "Trending" for the MVP = Rankings with the most combined community
// activity (likes + reputation credits) across all their nominees. No
// separate analytics system needed — it's a derived read.
export async function listTrendingRankings(limit = 10, city?: string): Promise<Ranking[]> {
  const cityClause = city ? "AND r.city = ?" : "";
  const rows = (await db
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
    .all(...(city ? [city, limit] : [limit]))) as unknown as (RankingRow & { activity_score: number })[];
  return rows.map(toRanking);
}

// Same "trending" scoring as listTrendingRankings, but scoped to a whole
// country instead of one city — used for the homepage's "Popular in
// {country}" tier. excludeCity lets the homepage skip Rankings already
// shown in the city-level tier above it, so the two sections don't repeat
// each other.
export async function listTrendingRankingsForCountry(
  limit: number,
  country: string,
  excludeCity?: string
): Promise<Ranking[]> {
  const excludeClause = excludeCity ? "AND r.city != ?" : "";
  const rows = (await db
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
    )) as unknown as (RankingRow & { activity_score: number })[];
  return rows.map(toRanking);
}

export interface RegionCount {
  country: string;
  city: string;
  rankingCount: number;
}

export async function listPopularRegions(limit = 8): Promise<RegionCount[]> {
  const rows = (await db
    .prepare(
      `SELECT country, city, COUNT(*) AS ranking_count
       FROM rankings
       WHERE ${PUBLIC_WHERE}
       GROUP BY country, city
       ORDER BY ranking_count DESC
       LIMIT ?`
    )
    .all(limit)) as unknown as { country: string; city: string; ranking_count: number }[];
  return rows.map((r) => ({
    country: r.country,
    city: r.city,
    rankingCount: r.ranking_count,
  }));
}

// Ranking counts keyed by city, for the "All Regions" / per-country
// directory views — only cities with at least one public Ranking show up
// as keys here. Callers must treat any city missing from this map as a
// count of 0 (e.g. a configured MVP city with no Rankings yet), since
// this query has no reason to know about the full configured city list
// in src/lib/locations.ts.
export async function getRankingCountsByCity(): Promise<Record<string, number>> {
  const rows = (await db
    .prepare(
      `SELECT city, COUNT(*) AS c FROM rankings WHERE ${PUBLIC_WHERE} GROUP BY city`
    )
    .all()) as unknown as { city: string; c: number }[];
  return Object.fromEntries(rows.map((r) => [r.city, r.c]));
}

// Free-text search across Ranking titles and descriptions (case- and
// accent-insensitive via LIKE, since SQLite's LIKE is already
// case-insensitive for ASCII). Deliberately global — ignores the
// location-first default so a search always looks across every open
// country, not just the user's own city.
export async function searchRankings(query: string, limit = 40): Promise<Ranking[]> {
  // Escape LIKE's own wildcard characters in the user's input so
  // searching for e.g. "50%" or "a_b" behaves as a literal search
  // instead of an unintended wildcard match.
  const escaped = query.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
  const like = `%${escaped}%`;
  const rows = (await db
    .prepare(
      `SELECT * FROM rankings
       WHERE ${PUBLIC_WHERE} AND (title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(like, like, limit)) as unknown as RankingRow[];
  return rows.map(toRanking);
}

// Sort here is pinned-first, then admin-defined display_order — this is
// the "browse this region's Rankings" ordering the admin controls panel
// manages. created_at DESC remains as a tiebreaker only (e.g. legacy rows
// that briefly share a display_order during backfill).
export async function listAllRankings(): Promise<Ranking[]> {
  const rows = (await db
    .prepare(
      `SELECT * FROM rankings WHERE ${PUBLIC_WHERE} ORDER BY is_pinned DESC, display_order ASC, created_at DESC`
    )
    .all()) as unknown as RankingRow[];
  return rows.map(toRanking);
}

// Unfiltered — includes hidden AND soft-deleted Rankings. Admin
// moderation panel only, so admins can find and restore either.
export async function listAllRankingsForAdmin(): Promise<Ranking[]> {
  const rows = (await db
    .prepare("SELECT * FROM rankings ORDER BY created_at DESC")
    .all()) as unknown as RankingRow[];
  return rows.map(toRanking);
}

export async function searchRankingsByRegion(params: {
  country?: string;
  city?: string;
}): Promise<Ranking[]> {
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
  const rows = (await db
    .prepare(
      `SELECT * FROM rankings ${where} ORDER BY is_pinned DESC, display_order ASC, created_at DESC`
    )
    .all(...values)) as unknown as RankingRow[];
  return rows.map(toRanking);
}

export async function setRankingHidden(id: string, hidden: boolean): Promise<void> {
  await db.prepare("UPDATE rankings SET is_hidden = ? WHERE id = ?").run(
    hidden ? 1 : 0,
    id
  );
}

// Soft delete: marks the Ranking as deleted without touching anything
// else. Nominees, Likes, Payments, and Credit Transactions tied to this
// Ranking are left completely intact — there is no cascade. Restoring
// (below) makes them all visible again immediately, because they were
// never actually removed.
export async function softDeleteRanking(id: string): Promise<void> {
  await db
    .prepare(
      "UPDATE rankings SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL"
    )
    .run(id);
}

export async function restoreRanking(id: string): Promise<void> {
  await db.prepare("UPDATE rankings SET deleted_at = NULL WHERE id = ?").run(id);
}

// Mirrors setRankingHidden() above. Reused by the /admin/rankings Pin/Unpin
// buttons; visibility (is_hidden) and pin (is_pinned) are separate flags
// that can be combined freely — pinning never changes visibility and vice
// versa.
export async function setRankingPinned(id: string, pinned: boolean): Promise<void> {
  await db
    .prepare("UPDATE rankings SET is_pinned = ? WHERE id = ?")
    .run(pinned ? 1 : 0, id);
}

// Persists a new drag-and-drop order for one city's Rankings. orderedIds
// must be every Ranking id currently shown in that city's admin list, in
// their new top-to-bottom order (pinned and unpinned Rankings mixed
// together exactly as the admin UI displays them) — index 0 becomes
// display_order 1, and so on. is_pinned is never touched here, so moving a
// card up or down never silently (un)pins it.
//
// The `AND city = ?` guard on every UPDATE is deliberate belt-and-braces:
// even if a caller somehow passed an id from a different city, that row's
// display_order simply wouldn't be touched, instead of corrupting another
// city's ordering.
export async function reorderRankingsInCity(
  city: string,
  orderedIds: string[]
): Promise<void> {
  const trimmedCity = city.trim();
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .prepare(
        "UPDATE rankings SET display_order = ? WHERE id = ? AND city = ?"
      )
      .run(i + 1, orderedIds[i], trimmedCity);
  }
}

// Backs the new /admin/rankings board. Unfiltered by hidden/pinned unless
// asked, but always excludes soft-deleted Rankings — restoring a
// soft-deleted Ranking is a distinct workflow that already lives on
// /admin/moderation, and a deleted Ranking has no meaningful position to
// drag into this board's order.
export async function listRankingsForAdmin(filters: {
  country?: string;
  city?: string;
  hidden?: boolean;
  pinned?: boolean;
}): Promise<Ranking[]> {
  const clauses: string[] = ["deleted_at IS NULL"];
  const values: (string | number)[] = [];
  if (filters.country) {
    clauses.push("country = ?");
    values.push(filters.country);
  }
  if (filters.city) {
    clauses.push("city = ?");
    values.push(filters.city);
  }
  if (filters.hidden !== undefined) {
    clauses.push("is_hidden = ?");
    values.push(filters.hidden ? 1 : 0);
  }
  if (filters.pinned !== undefined) {
    clauses.push("is_pinned = ?");
    values.push(filters.pinned ? 1 : 0);
  }
  const where = `WHERE ${clauses.join(" AND ")}`;
  const rows = (await db
    .prepare(
      `SELECT * FROM rankings ${where} ORDER BY is_pinned DESC, display_order ASC, created_at DESC`
    )
    .all(...values)) as unknown as RankingRow[];
  return rows.map(toRanking);
}
