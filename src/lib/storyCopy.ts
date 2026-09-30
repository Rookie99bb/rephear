import { resolveReasonEcho } from "./celebrationCopy";
import type { GrowthStage } from "./supportReasons";

// Phase 5.3 (Support Story & Backing Journey): pure copy builders for My
// Backing Stories / People I Back v2. Everything is computed from real
// data — components import these, scripts/smoke-phase5-story.ts
// unit-tests them.
//
// Authenticity rule (§23, non-negotiable): no causal claims. Climb copy
// says "You backed Mia during her climb", never "You moved Mia".
// "I Was There Early" renders ONLY when the data proves a real upward
// climb — never on flat or declined data.

// "2026-09-30 01:23:45" (sqlite datetime('now')) → "Sep 30, 2026".
export function formatStoryDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Real upward movement, proven by data: both ranks known and the
// current rank is strictly better (lower number). Flat or declined →
// false. This is the ONLY gate for "I Was There Early".
export function wasProvenClimb(
  rankAtSupport: number | null | undefined,
  currentRank: number | null | undefined
): boolean {
  return (
    rankAtSupport != null && currentRank != null && currentRank < rankAtSupport
  );
}

export interface BeforeAfterInput {
  profileName: string;
  rankAtSupport: number | null | undefined;
  currentRank: number | null | undefined;
}

// "You backed Mia at #23. Mia is now #3." — the name stands in for a
// pronoun (gender is unknown). Null when either rank is unknown; the
// card then omits the line rather than fabricating it.
export function buildBeforeAfterCopy(input: BeforeAfterInput): string | null {
  const { profileName, rankAtSupport, currentRank } = input;
  if (rankAtSupport == null || currentRank == null) return null;
  return `You backed ${profileName} at #${rankAtSupport}. ${profileName} is now #${currentRank}.`;
}

// Badge line for a proven climb. Null otherwise — declined/flat stories
// are kept honestly, never reframed as a win.
export function buildEarlyBadgeCopy(
  rankAtSupport: number | null | undefined,
  currentRank: number | null | undefined
): string | null {
  return wasProvenClimb(rankAtSupport, currentRank)
    ? "🏆 I Was There Early"
    : null;
}

// Compact rank arrow for cards: "#23 → #3". Null unless both known.
export function buildRankArrow(
  rankAtSupport: number | null | undefined,
  currentRank: number | null | undefined
): string | null {
  if (rankAtSupport == null || currentRank == null) return null;
  return `#${rankAtSupport} → #${currentRank}`;
}

const GROWTH_STAGE_LABELS: Record<GrowthStage, string> = {
  number_1: "#1",
  top_3: "Top 3",
  top_10: "Top 10",
  top_20: "Top 20",
  top_50: "Top 50",
  outside_top_50: "Outside Top 50",
  unranked: "Unranked",
};

export function humanizeGrowthStage(
  stage: GrowthStage | null | undefined
): string | null {
  if (!stage) return null;
  return GROWTH_STAGE_LABELS[stage] ?? null;
}

// "Top 50 → Top 3". Same stage twice → the single label. Null when
// either end is unknown.
export function buildJourneyProgressCopy(
  from: GrowthStage | null | undefined,
  to: GrowthStage | null | undefined
): string | null {
  const a = humanizeGrowthStage(from);
  const b = humanizeGrowthStage(to);
  if (!a || !b) return null;
  return a === b ? a : `${a} → ${b}`;
}

// Reason echo for story cards: preset labels render (public-safe);
// custom text renders only when the caller passes it — the DB layer
// supplies custom text to the owner only, so reuse here is safe.
export function resolveStoryReasonEcho(
  reasonKey: string | null | undefined,
  reasonText: string | null | undefined
): string | null {
  return resolveReasonEcho(reasonKey, reasonText);
}
