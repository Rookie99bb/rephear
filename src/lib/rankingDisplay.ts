import type { Ranking } from "./types";

// Location display for ranking cards. Rankings flagged global show
// "🌍 Global"; local rankings show "📍 City, Country". Never invents a
// location — falls back to Global when city/country are missing.
export function getRankingLocationLabel(ranking: Ranking): string {
  if (ranking.isGlobal) return "🌍 Global";
  const city = ranking.city?.trim();
  const country = ranking.country?.trim();
  if (city && country) return `📍 ${city}, ${country}`;
  if (country) return `📍 ${country}`;
  return "🌍 Global";
}

// Plain-text location phrase (no emoji) for metadata/SEO copy.
export function getRankingLocationPhrase(ranking: Ranking): string {
  if (ranking.isGlobal) return "Global";
  const city = ranking.city?.trim();
  const country = ranking.country?.trim();
  if (city && country) return `${city}, ${country}`;
  return country || "Global";
}

export type RankingBadge = "rising" | "new" | "most-loved";

export const RANKING_BADGE_META: Record<RankingBadge, { emoji: string; label: string }> = {
  rising: { emoji: "🔥", label: "Rising" },
  new: { emoji: "✨", label: "New" },
  "most-loved": { emoji: "💜", label: "Most Loved" },
};

// 12400 -> "12.4K", 950 -> "950"
export function formatCompactCount(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v >= 100 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return `${v >= 100 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return `${n}`;
}
