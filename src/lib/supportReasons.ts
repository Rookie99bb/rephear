// Phase 5.1 (Support Story & Backing Journey): "Why are you backing them?"
// preset reasons. The keys are stable identifiers stored in
// payments.support_reason / backing_moments.support_reason; the labels
// are display copy only and may change without a migration.
//
// The reason is OPTIONAL and never blocks checkout. Stored per moment so
// the Phase 5.7 identity engine can later derive behavior patterns
// (Talent Spotter, Underdog Backer, Loyal Backer) — never a badge from a
// single selection.
export const SUPPORT_REASON_PRESETS = {
  deserves_recognition: "💎 She deserves more recognition",
  believe_potential: "🌱 I believe in her potential",
  love_work: "🎭 I love her work",
  following_awhile: "❤️ I've been following her for a while",
  want_rise: "🚀 I want to see her rise",
  discovered_early: "✨ I discovered her early",
} as const;

export type SupportReasonPreset = keyof typeof SUPPORT_REASON_PRESETS;

// "custom" is a real stored key (✍️ "Say it in your own words") — the
// free text lives in support_reason_text. Custom text is author-only
// until Phase 2 moderation primitives exist; never rendered publicly.
export const SUPPORT_REASON_CUSTOM = "custom" as const;

const PRESET_KEYS = new Set<string>([
  ...Object.keys(SUPPORT_REASON_PRESETS),
  SUPPORT_REASON_CUSTOM,
]);

export function isSupportReason(value: unknown): value is SupportReasonPreset | typeof SUPPORT_REASON_CUSTOM {
  return typeof value === "string" && PRESET_KEYS.has(value);
}

// Free-text reason: trimmed, capped at 280 chars. Never blocks —
// overlong input is truncated, not rejected.
export const SUPPORT_REASON_TEXT_MAX = 280;

export function normalizeSupportReasonText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, SUPPORT_REASON_TEXT_MAX);
  return trimmed === "" ? null : trimmed;
}

// Growth stage is computed ONCE at snapshot time from the nominee's
// Most-Supported rank and stored as TEXT — never recomputed, so the
// story can't drift as the ranking moves.
export type GrowthStage =
  | "unranked"
  | "outside_top_50"
  | "top_50"
  | "top_20"
  | "top_10"
  | "top_3"
  | "number_1";

export function growthStageForRank(rank: number | null | undefined): GrowthStage {
  if (rank == null || rank < 1) return "unranked";
  if (rank === 1) return "number_1";
  if (rank <= 3) return "top_3";
  if (rank <= 10) return "top_10";
  if (rank <= 20) return "top_20";
  if (rank <= 50) return "top_50";
  return "outside_top_50";
}
