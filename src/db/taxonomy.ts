import { db } from "./client";
import { newId } from "@/lib/id";
import type { Ranking, Subcategory } from "@/lib/types";
import type { RankingRow } from "./rankings";

// -----------------------------------------------------------------------
// Taxonomy v2 (2026-09-30): the canonical 13 primary categories and their
// subcategories. This file is the single source of truth — seedTaxonomy.ts
// builds the DB rows from TAXONOMY below, and the migration
// (migrateTaxonomy.ts) remaps legacy categories onto it.
//
// Slug conventions:
// - Category slugs: short, stable, human-readable ("anime", "music").
// - Subcategory slugs: "<category-slug>-<sub>" ("music-rap-grime") so
//   slugs stay globally unique even when names repeat across parents
//   (e.g. "Music" is both an Anime subcategory and a top-level category).
// -----------------------------------------------------------------------

export interface SubcategorySeed {
  name: string;
  slug: string;
  description?: string;
}

export interface CategorySeed {
  name: string;
  slug: string;
  description?: string;
  subcategories: SubcategorySeed[];
}

export const TAXONOMY: CategorySeed[] = [
  {
    name: "Anime",
    slug: "anime",
    description: "Anime series, characters, battles, ships and hot takes.",
    subcategories: [
      { name: "Trending", slug: "anime-trending" },
      { name: "Series", slug: "anime-series" },
      { name: "Characters", slug: "anime-characters" },
      { name: "Battles", slug: "anime-battles" },
      { name: "Ships", slug: "anime-ships" },
      { name: "Music", slug: "anime-music" },
      { name: "Visuals", slug: "anime-visuals" },
      { name: "Hot Takes", slug: "anime-hot-takes" },
      { name: "Community", slug: "anime-community" },
    ],
  },
  {
    name: "Manga",
    slug: "manga",
    description: "Manga series, art, characters and genres.",
    subcategories: [
      { name: "Trending", slug: "manga-trending" },
      { name: "Series", slug: "manga-series" },
      { name: "Hot Takes", slug: "manga-hot-takes" },
      { name: "Characters", slug: "manga-characters" },
      { name: "Art", slug: "manga-art" },
      { name: "Romance", slug: "manga-romance" },
      { name: "Horror", slug: "manga-horror" },
      { name: "Fantasy", slug: "manga-fantasy" },
      { name: "Genres", slug: "manga-genres" },
      { name: "Adaptations", slug: "manga-adaptations" },
    ],
  },
  {
    name: "Gaming",
    slug: "gaming",
    description: "Games, characters, esports and gaming communities.",
    subcategories: [
      { name: "Trending", slug: "gaming-trending" },
      { name: "Games", slug: "gaming-games" },
      { name: "Hot Takes", slug: "gaming-hot-takes" },
      { name: "Characters", slug: "gaming-characters" },
      { name: "Multiplayer", slug: "gaming-multiplayer" },
      { name: "RPG", slug: "gaming-rpg" },
      { name: "Indie", slug: "gaming-indie" },
      { name: "Esports", slug: "gaming-esports-sub" },
      { name: "Community", slug: "gaming-community" },
      { name: "Tabletop", slug: "gaming-tabletop" },
    ],
  },
  {
    name: "Cosplay",
    slug: "cosplay",
    description: "Cosplayers, costumes, craft and convention culture.",
    subcategories: [
      { name: "Trending", slug: "cosplay-trending" },
      { name: "Creators", slug: "cosplay-creators" },
      { name: "Anime", slug: "cosplay-anime" },
      { name: "Gaming", slug: "cosplay-gaming" },
      { name: "Costume", slug: "cosplay-costume" },
      { name: "Makeup", slug: "cosplay-makeup" },
      { name: "Performance", slug: "cosplay-performance" },
      { name: "Photography", slug: "cosplay-photography" },
      { name: "Rising", slug: "cosplay-rising" },
    ],
  },
  {
    name: "Digital Creators",
    slug: "digital-creators",
    description: "TikTokers, YouTubers, streamers, VTubers and fan creators.",
    subcategories: [
      { name: "Anime", slug: "digital-creators-anime" },
      { name: "Manga", slug: "digital-creators-manga" },
      { name: "Gaming", slug: "digital-creators-gaming" },
      { name: "Cosplay", slug: "digital-creators-cosplay" },
      { name: "TikTok", slug: "digital-creators-tiktok" },
      { name: "YouTube", slug: "digital-creators-youtube" },
      { name: "Streamers", slug: "digital-creators-streamers" },
      { name: "VTubers", slug: "digital-creators-vtubers" },
      { name: "Video Editors", slug: "digital-creators-video-editors" },
      { name: "Fan Artists", slug: "digital-creators-fan-artists" },
      { name: "Meme Creators", slug: "digital-creators-meme-creators" },
      { name: "Podcasters", slug: "digital-creators-podcasters" },
    ],
  },
  {
    name: "Music",
    slug: "music",
    description: "DJs, rap, grime, K-pop, producers and radio.",
    subcategories: [
      { name: "DJs", slug: "music-djs" },
      { name: "Rap & Grime", slug: "music-rap-grime" },
      { name: "K-pop", slug: "music-kpop" },
      { name: "Producers", slug: "music-producers" },
      { name: "Radio", slug: "music-radio" },
      { name: "Live Music", slug: "music-live-music" },
      { name: "Underground", slug: "music-underground" },
    ],
  },
  {
    name: "Fashion",
    slug: "fashion",
    description: "Streetwear, beauty and fashion creators.",
    subcategories: [
      { name: "Streetwear", slug: "fashion-streetwear" },
      { name: "Beauty", slug: "fashion-beauty" },
      { name: "Creators", slug: "fashion-creators" },
    ],
  },
  {
    name: "Art",
    slug: "art",
    description: "Illustration, zines and visual artists.",
    subcategories: [
      { name: "Illustration", slug: "art-illustration" },
      { name: "Zines", slug: "art-zines" },
      { name: "Creators", slug: "art-creators" },
    ],
  },
  {
    name: "University",
    slug: "university",
    description: "University societies and student creators.",
    subcategories: [
      { name: "Societies", slug: "university-societies-sub" },
      { name: "Creators", slug: "university-creators" },
    ],
  },
  {
    name: "Food",
    slug: "food",
    description: "Food creators and spots.",
    subcategories: [
      { name: "Creators", slug: "food-creators" },
      { name: "Spots", slug: "food-spots" },
    ],
  },
  {
    name: "Sports",
    slug: "sports",
    description: "Football culture, fanbases and sports creators.",
    subcategories: [
      { name: "Football", slug: "sports-football" },
      { name: "Fan Culture", slug: "sports-fan-culture" },
    ],
  },
  {
    name: "Entertainment",
    slug: "entertainment",
    description: "Comedy, film, TV and entertainment personalities.",
    subcategories: [
      { name: "Comedy", slug: "entertainment-comedy" },
      { name: "Film & TV", slug: "entertainment-film-tv" },
      { name: "Personalities", slug: "entertainment-personalities" },
    ],
  },
  {
    name: "Events & Nightlife",
    slug: "events-nightlife",
    description: "Club nights, venues, promoters and festivals.",
    subcategories: [
      { name: "Club Nights", slug: "events-nightlife-club-nights" },
      { name: "Venues", slug: "events-nightlife-venues" },
      { name: "Promoters", slug: "events-nightlife-promoters" },
      {
        name: "Nightlife Personalities",
        slug: "events-nightlife-nightlife-personalities",
      },
      { name: "Festivals", slug: "events-nightlife-festivals" },
    ],
  },
];

// Legacy (pre-v2) category slug → v2 category slug. Used by the data
// migration (migrateTaxonomy.ts) and by the /rankings page to 301-redirect
// old ?category=<slug> links to the new taxonomy. Slugs NOT listed here
// are either already v2 slugs or unknown (unknown → no redirect).
export const CATEGORY_REDIRECTS: Record<string, string> = {
  "underground-rap": "music",
  "uk-rap-grime": "music",
  "dj-genres": "music",
  "djs-club-culture": "music",
  "underground-music": "music",
  "radio-livestream": "music",
  "kpop-dance": "music",
  "club-nights": "events-nightlife",
  "nightlife-personalities": "events-nightlife",
  "scene-rivalries": "events-nightlife",
  "football-culture": "sports",
  "football-tribes": "sports",
  "skate-street-culture": "sports",
  "comedy": "entertainment",
  "screen-stage": "entertainment",
  "cult-culture-community": "entertainment",
  "streetwear-fashion-creators": "fashion",
  "alternative-fashion": "fashion",
  "beauty-creators": "fashion",
  "independent-art-zines": "art",
  "food-drink-creators": "food",
  "food-wars": "food",
  "university-societies": "university",
  "anime-japanese-subculture": "anime",
  "gaming-esports": "gaming",
  "tabletop-tcg-roleplaying": "gaming",
};

// -----------------------------------------------------------------------
// Scope. Canonical source of truth is ranking.scope ('global' |
// 'country' | 'city', Phase 10 of the content spec); isGlobal is a
// derived compatibility flag (isGlobal = scope === 'global').
// -----------------------------------------------------------------------
export type RankingScope = "global" | "country" | "city";

export function rankingScope(
  ranking: Pick<Ranking, "scope" | "isGlobal">
): RankingScope {
  if (ranking.scope === "global" || ranking.scope === "country" || ranking.scope === "city")
    return ranking.scope;
  return ranking.isGlobal ? "global" : "city";
}

export function scopeLabel(
  ranking: Pick<Ranking, "scope" | "isGlobal" | "city" | "country">
): string {
  const scope = rankingScope(ranking);
  if (scope === "global") return "🌍 Global";
  if (scope === "country") {
    // Never show a city for country-scoped rankings.
    return ranking.country ? `📍 ${ranking.country}` : "🌍 Global";
  }
  if (ranking.city && ranking.country)
    return `📍 ${ranking.city}, ${ranking.country}`;
  if (ranking.country) return `📍 ${ranking.country}`;
  if (ranking.city) return `📍 ${ranking.city}`;
  return "🌍 Global";
}

// -----------------------------------------------------------------------
// Tags. Stored as a comma-separated string on rankings.tags; helpers
// keep the parse/format in one place.
// -----------------------------------------------------------------------
export function parseTags(tags: string | null | undefined): string[] {
  if (!tags) return [];
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function formatTags(tags: string[]): string {
  return tags.map((t) => t.trim()).filter(Boolean).join(", ");
}

// -----------------------------------------------------------------------
// Subcategory data access (mirrors categories.ts conventions: slug is
// the stable identifier, find-or-create is idempotent).
// -----------------------------------------------------------------------
interface SubcategoryRow {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  created_at: string;
}

function toSubcategory(row: SubcategoryRow): Subcategory {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export async function findSubcategoryBySlug(
  slug: string
): Promise<Subcategory | null> {
  const row = (await db
    .prepare("SELECT * FROM subcategories WHERE slug = ?")
    .get(slug)) as unknown as SubcategoryRow | undefined;
  return row ? toSubcategory(row) : null;
}

export async function findSubcategoryById(
  id: string
): Promise<Subcategory | null> {
  const row = (await db
    .prepare("SELECT * FROM subcategories WHERE id = ?")
    .get(id)) as unknown as SubcategoryRow | undefined;
  return row ? toSubcategory(row) : null;
}

export async function listSubcategories(
  categoryId: string
): Promise<Subcategory[]> {
  const rows = (await db
    .prepare(
      "SELECT * FROM subcategories WHERE category_id = ? ORDER BY sort_order ASC, name ASC"
    )
    .all(categoryId)) as unknown as SubcategoryRow[];
  return rows.map(toSubcategory);
}

// All subcategories across every category (admin board grouping).
export async function listAllSubcategories(): Promise<Subcategory[]> {
  const rows = (await db
    .prepare("SELECT * FROM subcategories ORDER BY category_id, sort_order ASC, name ASC")
    .all()) as unknown as SubcategoryRow[];
  return rows.map(toSubcategory);
}

export async function listSubcategoriesByCategorySlug(
  categorySlug: string
): Promise<Subcategory[]> {
  const rows = (await db
    .prepare(
      `SELECT s.* FROM subcategories s
       JOIN categories c ON c.id = s.category_id
       WHERE c.slug = ?
       ORDER BY s.sort_order ASC, s.name ASC`
    )
    .all(categorySlug)) as unknown as SubcategoryRow[];
  return rows.map(toSubcategory);
}

// Idempotent: returns the existing row if the slug is taken, otherwise
// creates it under the given category.
export async function findOrCreateSubcategory(params: {
  categoryId: string;
  name: string;
  slug: string;
  description?: string;
  sortOrder?: number;
}): Promise<Subcategory> {
  const existing = await findSubcategoryBySlug(params.slug);
  if (existing) return existing;
  const id = newId();
  await db
    .prepare(
      `INSERT INTO subcategories (id, category_id, name, slug, description, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      params.categoryId,
      params.name.trim(),
      params.slug.trim(),
      params.description?.trim() ?? "",
      params.sortOrder ?? 0
    );
  return (await findSubcategoryById(id))!;
}

export async function countRankingsInSubcategory(
  subcategoryId: string
): Promise<number> {
  const row = (await db
    .prepare(
      "SELECT COUNT(*) as count FROM rankings WHERE subcategory_id = ? AND deleted_at IS NULL AND is_hidden = 0 AND COALESCE(is_archived, 0) = 0"
    )
    .get(subcategoryId)) as unknown as { count: number } | undefined;
  return row?.count ?? 0;
}

// Public rankings for a category page. Ordering is transparent and
// useful without engagement data: most nominees first (populated
// rankings surface), then newest, then title. Archived/hidden/deleted
// rows are excluded.
export async function listPublicRankingsByCategory(
  categoryId: string,
  opts?: { subcategoryId?: string; limit?: number }
): Promise<Ranking[]> {
  const where = [
    "r.category_id = ?",
    "r.deleted_at IS NULL",
    "r.is_hidden = 0",
    "COALESCE(r.is_archived, 0) = 0",
  ];
  const params: (string | number)[] = [categoryId];
  if (opts?.subcategoryId) {
    where.push("r.subcategory_id = ?");
    params.push(opts.subcategoryId);
  }
  const limit = opts?.limit ?? 200;
  const rows = (await db
    .prepare(
      `SELECT r.*,
         (SELECT COUNT(*) FROM profiles p WHERE p.ranking_id = r.id AND p.deleted_at IS NULL) AS nominee_count
       FROM rankings r
       WHERE ${where.join(" AND ")}
       ORDER BY nominee_count DESC, r.created_at DESC, r.title ASC
       LIMIT ?`
    )
    .all(...params, limit)) as unknown as RankingRow[];
  const { toRanking } = await import("./rankings");
  return rows.map(toRanking);
}

export async function countPublicRankingsByCategory(
  categoryId: string
): Promise<number> {
  const row = (await db
    .prepare(
      "SELECT COUNT(*) as count FROM rankings WHERE category_id = ? AND deleted_at IS NULL AND is_hidden = 0 AND COALESCE(is_archived, 0) = 0"
    )
    .get(categoryId)) as unknown as { count: number } | undefined;
  return row?.count ?? 0;
}

// "You might also like" for empty subcategories: up to 3 public
// rankings, preferring the same primary category (other subcategories),
// then filling from the other taxonomy categories in TAXONOMY order.
// Never includes the excluded ids.
export async function getAdjacentRankings(
  categorySlug: string,
  opts?: { excludeIds?: string[]; limit?: number }
): Promise<Ranking[]> {
  const { toRanking } = await import("./rankings");
  const limit = opts?.limit ?? 3;
  const exclude = new Set(opts?.excludeIds ?? []);
  const out: Ranking[] = [];
  const seen = new Set<string>();

  async function take(categoryId: string, excludeSubId?: string | null) {
    const where = [
      "r.category_id = ?",
      "r.deleted_at IS NULL",
      "r.is_hidden = 0",
      "COALESCE(r.is_archived, 0) = 0",
    ];
    const params: (string | number | null)[] = [categoryId];
    if (excludeSubId !== undefined) {
      where.push("(r.subcategory_id IS NULL OR r.subcategory_id != ?)");
      params.push(excludeSubId);
    }
    const rows = (await db
      .prepare(
        `SELECT r.* FROM rankings r
         WHERE ${where.join(" AND ")}
         ORDER BY r.created_at DESC, r.title ASC
         LIMIT ?`
      )
      .all(...params, limit * 3)) as unknown as RankingRow[];
    for (const row of rows) {
      if (out.length >= limit || seen.has(row.id) || exclude.has(row.id))
        continue;
      seen.add(row.id);
      out.push(toRanking(row));
    }
  }

  const { findCategoryBySlug } = await import("./categories");
  const primary = await findCategoryBySlug(categorySlug);
  if (primary) await take(primary.id);

  // Fill from sibling taxonomy categories in canonical order.
  for (const catSeed of TAXONOMY) {
    if (out.length >= limit) break;
    if (catSeed.slug === categorySlug) continue;
    const cat = await findCategoryBySlug(catSeed.slug);
    if (cat) await take(cat.id);
  }
  return out.slice(0, limit);
}
