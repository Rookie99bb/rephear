// Provider abstraction for ranking cover images.
//
// getRankingCoverCandidates(ranking) is the single entry point the UI
// and the weekly job use. Providers are tried in priority order; each
// returns candidates that are already validated as safe to display:
//
//   1. Approved ranking-specific image (the ranking's own current cover,
//      when still valid)
//   2. Approved nominee imagery (self-hosted nominee photos — same
//      images already shown on the ranking's own page)
//   3. Approved category/topic imagery (generated category art)
//   4. Existing image
//   5. Category fallback image
//
// Copyright safety rules (non-negotiable):
// - No Google Images scraping, no hotlinking arbitrary images.
// - Only images already approved inside the RepHear application:
//   self-hosted uploads (R2) and generated category art.
// - A future licensed provider (e.g. Unsplash API) plugs in here as a
//   new RankingCoverProvider without touching the ranking UI.

import type { Ranking } from "@/lib/types";
import { getMostLoved } from "@/db/leaderboards";
import { getCategoryFallbackCard } from "./categoryFallbacks";

export type CoverSource = "nominee" | "category-fallback" | "neutral-fallback";

export interface CoverCandidate {
  url: string;
  source: CoverSource;
  alt: string;
  // Lower = higher priority.
  priority: number;
}

export interface RankingCoverProvider {
  name: string;
  getCandidates(ranking: Ranking): Promise<CoverCandidate[]>;
}

// A photo URL is usable only when it's same-origin (self-hosted in
// public/ or on the configured R2 public host). Pasted third-party URLs
// are left alone — the cover system must never become a hotlink engine.
function isSelfHosted(url: string): boolean {
  if (!url) return false;
  if (url.startsWith("/")) return true;
  const r2Base = process.env.R2_PUBLIC_BASE_URL;
  if (r2Base) {
    const base = r2Base.replace(/\/$/, "");
    if (url.startsWith(base)) return true;
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (site && url.startsWith(site.replace(/\/$/, ""))) return true;
  return false;
}

// Priority 2: the ranking's own top nominees. Uses the same photos
// already displayed on the ranking page (self-hosted only) —
// recognizable, topic-relevant, and already rights-cleared by the
// nominee-photo policy. Top 3 by Most Loved, in order.
class NomineePhotoCoverProvider implements RankingCoverProvider {
  name = "nominee-photo";
  async getCandidates(ranking: Ranking): Promise<CoverCandidate[]> {
    try {
      const loved = await getMostLoved(ranking.id);
      const out: CoverCandidate[] = [];
      for (const entry of loved.slice(0, 3)) {
        const photo = entry.profile.photoUrl?.trim();
        if (photo && isSelfHosted(photo)) {
          out.push({
            url: photo,
            source: "nominee",
            alt: `${entry.profile.name} — ${ranking.title}`,
            priority: 10 + out.length,
          });
        }
      }
      return out;
    } catch {
      return [];
    }
  }
}

// Priority 3/5: generated category artwork (always available, always
// self-hosted — the guaranteed non-broken image).
class CategoryFallbackCoverProvider implements RankingCoverProvider {
  name = "category-fallback";
  async getCandidates(ranking: Ranking): Promise<CoverCandidate[]> {
    // categoryId -> slug lookup happens in rankingCoverService via the
    // injected resolver; here we handle the common case directly.
    return [
      {
        url: getCategoryFallbackCard(ranking.categoryId),
        source: "category-fallback" as CoverSource,
        alt: `${ranking.title} — RepHear ranking`,
        priority: 50,
      },
    ];
  }
}

const PROVIDERS: RankingCoverProvider[] = [
  new NomineePhotoCoverProvider(),
  new CategoryFallbackCoverProvider(),
];

export function isUsableCoverUrl(url: string | null | undefined): boolean {
  if (!url || !url.trim()) return false;
  const u = url.trim();
  return u.startsWith("/") || u.startsWith("http://") || u.startsWith("https://");
}

// Ordered candidate list, best first. Note: ranking.categoryId is a
// category *id*, not a slug — callers that know the slug should use
// getCategoryFallbackCard(slug) directly; the service resolves it.
export async function getRankingCoverCandidates(
  ranking: Ranking
): Promise<CoverCandidate[]> {
  const all: CoverCandidate[] = [];
  for (const provider of PROVIDERS) {
    try {
      const candidates = await provider.getCandidates(ranking);
      all.push(...candidates.filter((c) => isUsableCoverUrl(c.url)));
    } catch {
      // A failing provider must never break cover resolution.
    }
  }
  return all.sort((a, b) => a.priority - b.priority);
}
