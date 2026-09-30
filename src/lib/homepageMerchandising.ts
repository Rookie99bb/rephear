import type { Ranking } from "@/lib/types";
import { findCategoryById } from "@/db/categories";

// Homepage editorial priority: which categories RepHear wants to
// spotlight during the current launch phase.
//
// This is a MERCHANDISING rule only. It does NOT change ranking scores,
// Most Loved / Most Supported calculations, or what's discoverable via
// Rankings / categories / search. Non-priority categories (Music, DJs,
// Nightlife, Football, etc.) remain fully in RepHear — they just don't
// dominate the homepage during the ACG-focused launch.
//
// Priority order (highest first):
//   Cosplay / Anime / Gaming / Manga
//   > ACG Creators
//   > ACG Events
//   > everything else
//
// Configurable: change this list to shift launch focus without touching
// homepage components.
export const HOMEPAGE_PRIORITY_CATEGORIES: string[] = [
  "cosplay",
  "anime",
  "gaming",
  "manga",
  "digital-creators", // ACG creators
  "events-nightlife", // ACG events (conventions, etc.)
];

// Category slugs that count as "ACG" for homepage diversity purposes.
// Used to ensure the trending row isn't filled with unrelated categories
// when eligible ACG content exists.
export const ACG_CATEGORY_SLUGS: string[] = [
  "cosplay",
  "anime",
  "anime-japanese-subculture",
  "gaming",
  "gaming-esports",
  "manga",
  "digital-creators",
];

const slugCache = new Map<string, string | null>();

export async function getCategorySlugForRanking(
  ranking: Ranking
): Promise<string | null> {
  if (!ranking.categoryId) return null;
  if (slugCache.has(ranking.categoryId)) {
    return slugCache.get(ranking.categoryId) ?? null;
  }
  try {
    const cat = await findCategoryById(ranking.categoryId);
    const slug = cat?.slug ?? null;
    slugCache.set(ranking.categoryId, slug);
    return slug;
  } catch {
    slugCache.set(ranking.categoryId, null);
    return null;
  }
}

// Priority index for a category slug. Lower = higher priority.
// Returns Infinity for non-priority categories (they sort last).
export function categoryPriorityIndex(slug: string | null): number {
  if (!slug) return Infinity;
  const idx = HOMEPAGE_PRIORITY_CATEGORIES.indexOf(slug);
  return idx === -1 ? Infinity : idx;
}

// Reorder rankings for homepage display: ACG categories first (in
// priority order), then everything else. Within the same priority tier,
// the ORIGINAL order is preserved (which reflects the underlying scores
// — we never re-rank, only re-prioritize for merchandising).
export async function prioritizeForHomepage<T extends { ranking: Ranking }>(
  items: T[]
): Promise<T[]> {
  const withSlug = await Promise.all(
    items.map(async (item) => ({
      item,
      slug: await getCategorySlugForRanking(item.ranking),
    }))
  );
  // Stable sort: priority tier first, original index as tiebreaker.
  return withSlug
    .map((x, originalIndex) => ({ ...x, originalIndex }))
    .sort((a, b) => {
      const pa = categoryPriorityIndex(a.slug);
      const pb = categoryPriorityIndex(b.slug);
      if (pa !== pb) return pa - pb;
      return a.originalIndex - b.originalIndex;
    })
    .map((x) => x.item);
}

// Check if a ranking's category is ACG (for diversity enforcement).
export async function isAcgRanking(ranking: Ranking): Promise<boolean> {
  const slug = await getCategorySlugForRanking(ranking);
  return slug !== null && ACG_CATEGORY_SLUGS.includes(slug);
}
