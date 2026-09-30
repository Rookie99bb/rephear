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
// Tier definitions for the ACG launch phase (strict spec).
// TIER 1: core ACG categories (in Featured selection priority order).
// TIER 2: ACG-related creators and events.
// TIER 3: everything else.
export const TIER1_CATEGORIES: string[] = [
  "anime",
  "gaming",
  "manga",
  "cosplay",
];

export const TIER2_CATEGORIES: string[] = [
  "digital-creators",
  "events-nightlife",
  "anime-japanese-subculture",
  "gaming-esports",
];

// Legacy priority list (kept for backwards compatibility).
// New code should use TIER1_CATEGORIES / TIER2_CATEGORIES.
export const HOMEPAGE_PRIORITY_CATEGORIES: string[] = [
  ...TIER1_CATEGORIES,
  ...TIER2_CATEGORIES,
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

// Tier of a category slug: 1 (core ACG), 2 (ACG creators/events), 3 (other).
export function tierForSlug(slug: string | null): 1 | 2 | 3 {
  if (!slug) return 3;
  if (TIER1_CATEGORIES.includes(slug)) return 1;
  if (TIER2_CATEGORIES.includes(slug)) return 2;
  return 3;
}

export async function tierForRanking(ranking: Ranking): Promise<1 | 2 | 3> {
  const slug = await getCategorySlugForRanking(ranking);
  return tierForSlug(slug);
}

// Select 3 Featured rankings from 3 DIFFERENT Tier-1 categories.
// Selection priority: Anime > Gaming > Manga > Cosplay.
// Within each category, the original order (velocity/score) is preserved.
// If fewer than 3 Tier-1 categories have eligible rankings, fills the
// remaining slots with the best available (Tier-2, then Tier-3) — but
// never duplicates a Tier-1 category while an unused eligible Tier-1
// category exists.
export async function selectFeaturedThree<T extends { ranking: Ranking }>(
  items: T[]
): Promise<T[]> {
  const withMeta = await Promise.all(
    items.map(async (item) => ({
      item,
      slug: await getCategorySlugForRanking(item.ranking),
    }))
  );

  const selected: T[] = [];
  const usedSlugs = new Set<string>();

  // Pass 1: one per Tier-1 category, in Anime > Gaming > Manga > Cosplay order.
  for (const tier1Slug of TIER1_CATEGORIES) {
    const candidate = withMeta.find(
      (x) => x.slug === tier1Slug && !selected.includes(x.item)
    );
    if (candidate) {
      selected.push(candidate.item);
      usedSlugs.add(tier1Slug);
    }
    if (selected.length >= 3) break;
  }

  // Pass 2: fill remaining slots with best available (any tier),
  // avoiding duplicate slugs where possible.
  if (selected.length < 3) {
    const sorted = [...withMeta].sort((a, b) => {
      const ta = tierForSlug(a.slug);
      const tb = tierForSlug(b.slug);
      if (ta !== tb) return ta - tb;
      return 0; // stable: preserves original order within tier
    });
    for (const x of sorted) {
      if (selected.length >= 3) break;
      if (selected.includes(x.item)) continue;
      // Avoid duplicate Tier-1 slugs if we haven't tried all Tier-1 yet.
      if (
        x.slug &&
        TIER1_CATEGORIES.includes(x.slug) &&
        usedSlugs.has(x.slug)
      ) {
        continue;
      }
      selected.push(x.item);
      if (x.slug) usedSlugs.add(x.slug);
    }
  }

  return selected.slice(0, 3);
}

// Select Explore rankings for the default homepage state:
// - First 4: exactly 1 Anime + 1 Gaming + 1 Manga + 1 Cosplay (in that order).
// - Next 4: ACG-prioritized (Tier-1, then Tier-2), avoiding unnecessary
//   category repetition.
// Returns up to 8 items. If insufficient ACG exists, fills with best
// available (never invents rankings).
export async function selectExploreEight<T extends { ranking: Ranking }>(
  items: T[]
): Promise<T[]> {
  const withMeta = await Promise.all(
    items.map(async (item) => ({
      item,
      slug: await getCategorySlugForRanking(item.ranking),
    }))
  );

  const selected: T[] = [];
  const usedSlugs = new Set<string>();

  // First 4: one per Tier-1 category.
  for (const tier1Slug of TIER1_CATEGORIES) {
    const candidate = withMeta.find(
      (x) => x.slug === tier1Slug && !selected.includes(x.item)
    );
    if (candidate) {
      selected.push(candidate.item);
      usedSlugs.add(tier1Slug);
    }
  }

  // Next 4: ACG-prioritized, avoid repetition.
  const acgSorted = [...withMeta]
    .filter((x) => !selected.includes(x.item))
    .sort((a, b) => {
      const ta = tierForSlug(a.slug);
      const tb = tierForSlug(b.slug);
      if (ta !== tb) return ta - tb;
      // Within same tier, prefer unused slugs (diversity).
      const aUsed = a.slug && usedSlugs.has(a.slug) ? 1 : 0;
      const bUsed = b.slug && usedSlugs.has(b.slug) ? 1 : 0;
      if (aUsed !== bUsed) return aUsed - bUsed;
      return 0;
    });

  for (const x of acgSorted) {
    if (selected.length >= 8) break;
    selected.push(x.item);
    if (x.slug) usedSlugs.add(x.slug);
  }

  return selected.slice(0, 8);
}
