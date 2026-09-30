// High-level cover resolution for one ranking: which image should the
// card show right now, and should the weekly job replace it?
//
// Priority order (see provider.ts for the copyright rules):
//   1. Approved ranking-specific image (current cover, when valid)
//   2. Approved nominee imagery (self-hosted top-nominee photos)
//   3. Approved category/topic imagery
//   4. Existing image
//   5. Category fallback image (always available, never broken)

import type { Ranking } from "@/lib/types";
import { findCategoryById } from "@/db/categories";
import {
  getRankingCoverCandidates,
  isUsableCoverUrl,
  type CoverCandidate,
} from "./provider";
import {
  getCategoryFallbackCard,
  getNeutralFallbackCard,
} from "./categoryFallbacks";

// Resolve a ranking's category *id* to its art slug (cached per call).
export async function getRankingCategorySlug(
  ranking: Ranking
): Promise<string | null> {
  if (!ranking.categoryId) return null;
  try {
    const cat = await findCategoryById(ranking.categoryId);
    return cat?.slug ?? null;
  } catch {
    return null;
  }
}

// The single best cover for display right now. Never throws, never
// returns a broken URL: category fallback -> neutral fallback.
export async function resolveCoverForRanking(
  ranking: Ranking
): Promise<{ url: string; alt: string; source: string }> {
  if (
    ranking.coverImageStatus !== "failed" &&
    isUsableCoverUrl(ranking.coverImageUrl)
  ) {
    return {
      url: ranking.coverImageUrl!.trim(),
      alt: ranking.coverImageAlt || `${ranking.title} — RepHear ranking`,
      source: ranking.coverImageSource || "existing",
    };
  }
  const slug = await getRankingCategorySlug(ranking);
  const candidates = await getRankingCoverCandidates(ranking);
  // Swap in the resolved slug for the category-fallback candidate.
  const best: CoverCandidate | undefined = candidates[0];
  if (best && best.source === "category-fallback") {
    best.url = getCategoryFallbackCard(slug);
  }
  if (best) {
    return { url: best.url, alt: best.alt, source: best.source };
  }
  return {
    url: getNeutralFallbackCard(),
    alt: `${ranking.title} — RepHear ranking`,
    source: "neutral-fallback",
  };
}

export interface RefreshDecision {
  shouldRefresh: boolean;
  candidate: CoverCandidate | null;
  // top_nominee_changed | trending | stale_cover | broken_source |
  // better_candidate | fallback | unchanged
  reason: string;
}

// Should the weekly job replace this ranking's cover?
// Rules (§11): check every week, but only replace when something
// meaningful changed — never churn images for the sake of it.
export async function decideCoverRefresh(
  ranking: Ranking,
  ctx: {
    // ids of the ranking's current top-3 nominee photos (self-hosted)
    topNomineePhotoUrls: string[];
    // true when the ranking is in this week's Rising set
    isRising: boolean;
    // true when created in the last 30 days
    isNew: boolean;
    // days since cover_image_updated_at (Infinity when never set)
    coverAgeDays: number;
  }
): Promise<RefreshDecision> {
  const noChange: RefreshDecision = {
    shouldRefresh: false,
    candidate: null,
    reason: "unchanged",
  };
  if (ranking.coverImageStatus === "manual") return noChange;

  const current = (ranking.coverImageUrl || "").trim();
  const currentValid = isUsableCoverUrl(current);

  // Broken or missing cover: pick the best candidate immediately.
  if (!currentValid) {
    const candidates = await getRankingCoverCandidates(ranking);
    const slug = await getRankingCategorySlug(ranking);
    const best = candidates[0];
    if (best) {
      if (best.source === "category-fallback") best.url = getCategoryFallbackCard(slug);
      return { shouldRefresh: true, candidate: best, reason: "broken_source" };
    }
    return {
      shouldRefresh: true,
      candidate: {
        url: getNeutralFallbackCard(),
        source: "neutral-fallback",
        alt: `${ranking.title} — RepHear ranking`,
        priority: 99,
      },
      reason: "fallback",
    };
  }

  // Current cover is a nominee photo but the top nominees changed
  // (e.g. a new leader with a photo took over) — follow the ranking.
  if (ranking.coverImageSource === "nominee" && ctx.topNomineePhotoUrls.length > 0) {
    if (!ctx.topNomineePhotoUrls.includes(current)) {
      const candidates = await getRankingCoverCandidates(ranking);
      const nominee = candidates.find((c) => c.source === "nominee");
      if (nominee) {
        return { shouldRefresh: true, candidate: nominee, reason: "top_nominee_changed" };
      }
    }
  }

  // Trending rankings get image-refresh priority: a fresh, relevant
  // nominee photo beats a stale category illustration.
  if (ctx.isRising && ranking.coverImageSource !== "nominee") {
    const candidates = await getRankingCoverCandidates(ranking);
    const nominee = candidates.find((c) => c.source === "nominee");
    if (nominee && nominee.url !== current) {
      return { shouldRefresh: true, candidate: nominee, reason: "trending" };
    }
  }

  // Stale covers (older than 90 days, non-nominee) get a fresh look at
  // the best candidate — but only switch if it's materially different.
  if (ctx.coverAgeDays > 90 && ranking.coverImageSource !== "nominee") {
    const candidates = await getRankingCoverCandidates(ranking);
    const best = candidates[0];
    if (best && best.url !== current) {
      return { shouldRefresh: true, candidate: best, reason: "stale_cover" };
    }
  }

  // New rankings with no cover yet: give them their first real cover.
  if (ctx.isNew && ranking.coverImageStatus === "pending" && !current) {
    const candidates = await getRankingCoverCandidates(ranking);
    const best = candidates[0];
    if (best) {
      return { shouldRefresh: true, candidate: best, reason: "better_candidate" };
    }
  }

  return noChange;
}
