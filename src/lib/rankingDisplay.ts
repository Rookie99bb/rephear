import type { Ranking } from "./types";

// Location display for ranking cards. Rankings flagged global show
// "🌍 Global"; local rankings show "📍 City, Country". Never invents a
// location — falls back to Global when city/country are missing.
// Scope is the canonical signal (is_global is kept in sync at write
// time); either flag marks a ranking global.
//
// Product scope is Global + London only (2026-10-01): no country scope,
// no other cities, no entity-type inference. The DB city on global rows
// is kept for access gating and is NEVER rendered.
//
// Options:
// - plain: strip the emoji → "Global" / "London, United Kingdom"
//   (nominee cards use the plain form; page headers use the emoji form).
export function getRankingLocationLabel(
  ranking: Ranking,
  opts?: { plain?: boolean }
): string {
  const plain = opts?.plain === true;
  if (ranking.scope === "global" || ranking.isGlobal)
    return plain ? "Global" : "🌍 Global";
  const city = ranking.city?.trim();
  const country = ranking.country?.trim();
  if (city && country) return plain ? `${city}, ${country}` : `📍 ${city}, ${country}`;
  if (country) return plain ? country : `📍 ${country}`;
  return plain ? "Global" : "🌍 Global";
}

/**
 * The location line for a NOMINEE CARD (scope-only, 2026-10-01):
 * - global ranking → null (no location row at all; the page header
 *   already carries the 🌍 Global badge). profile.region is never shown.
 * - local ranking  → plain-text "London, United Kingdom" (no emoji).
 *   The RANKING's location is shown; profile.region never overrides it.
 * The ranking row's stored city is left untouched (gating still uses it),
 * so a global row that retains London in the DB still renders no London
 * here.
 */
export function getNomineeCardLocationLabel(ranking: Ranking): string | null {
  if (ranking.scope === "global" || ranking.isGlobal) return null;
  return getRankingLocationLabel(ranking, { plain: true });
}

// Plain-text location phrase (no emoji) for metadata/SEO copy.
// Legacy alias — prefer getRankingLocationLabel(ranking, { plain: true }).
export function getRankingLocationPhrase(ranking: Ranking): string {
  return getRankingLocationLabel(ranking, { plain: true });
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
