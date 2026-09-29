// Phase 5.2 (Support Story & Backing Journey): pure copy builders for the
// story-start celebration. Everything here is computed from real data —
// the dialog imports these, and scripts/smoke-phase5-story.ts unit-tests
// them. No fiat symbols, no supporter-count gaps, no fabricated movement.
//
// Authenticity rule (§23, non-negotiable): never "You moved Mia into
// Top 10." unless causation is provable — the safe wording is
// "You backed Mia during her climb into the Top 10."

import {
  SUPPORT_REASON_PRESETS,
  SUPPORT_REASON_CUSTOM,
} from "./supportReasons";

// Credits-only Top 10 gap: "140 Credits behind the current Top 10".
// Null when there is no gap to show (already in the Top 10, or no
// threshold). Never "£14 away", never "8 Supports away" (§8).
export function formatTop10Gap(
  gapCredits: number | null | undefined
): string | null {
  if (gapCredits == null || gapCredits <= 0) return null;
  return `${gapCredits.toLocaleString()} Credits behind the current Top 10`;
}

export interface ImpactInput {
  profileName: string;
  rankBefore: number | null | undefined;
  rankAfter: number | null | undefined;
  gapToTop10: number | null | undefined;
}

export interface ImpactCopy {
  headline: string | null;
  body: string;
}

// Immediate Impact (§7): real movement only. Returns null when nothing
// real can be said (neither rank known) — the section is then omitted,
// never fabricated.
export function buildImpactCopy(input: ImpactInput): ImpactCopy | null {
  const { profileName, rankBefore, rankAfter, gapToTop10 } = input;
  const movedUp =
    rankBefore != null && rankAfter != null && rankAfter < rankBefore;

  if (movedUp) {
    // Real Top 10 entry: celebrate, but without a causation claim.
    if (rankAfter <= 10 && rankBefore > 10) {
      return {
        headline: `🏆 ${profileName.toUpperCase()} ENTERED THE TOP 10`,
        body: `You backed ${profileName} during the climb into the Top 10 — you were there when it happened.`,
      };
    }
    return {
      headline: null,
      body: `${profileName} climbed #${rankBefore} → #${rankAfter} in Most Supported.`,
    };
  }

  if (rankAfter != null) {
    const gap = formatTop10Gap(gapToTop10);
    return {
      headline: null,
      body: `${profileName} is now #${rankAfter} in Most Supported.${
        gap ? ` ${gap}.` : ""
      }`,
    };
  }

  return null;
}

// Reason echo (§6): renders the preset label or the author's own custom
// text. The only caller is the author's own celebration dialog
// (author-only until Phase 2 moderation primitives exist — never a
// public surface).
export function resolveReasonEcho(
  reasonKey: string | null | undefined,
  reasonText: string | null | undefined
): string | null {
  if (!reasonKey) return null;
  if (reasonKey === SUPPORT_REASON_CUSTOM) {
    const text = (reasonText ?? "").trim();
    return text ? `\u201C${text}\u201D` : null;
  }
  const label = (SUPPORT_REASON_PRESETS as Record<string, string>)[reasonKey];
  return label ?? null;
}

// Growth stages recorded in backing_moments.growth_stage_at_support that
// were outside the Top 10. "Backed Before Top 10" is DERIVED from this +
// a real threshold crossing at celebration time — never a stored flag
// (the moment row stays immutable; 5.7 / Phase 3 milestone cron will
// derive it the same way).
const OUTSIDE_TOP_10_STAGES = new Set([
  "unranked",
  "outside_top_50",
  "top_50",
  "top_20",
]);

export function wasOutsideTop10AtSupport(
  stage: string | null | undefined
): boolean {
  return !!stage && OUTSIDE_TOP_10_STAGES.has(stage);
}

export interface MomentSnapshotInput {
  rankAtSupport: number | null;
  totalCreditsAtSupport: number | null;
  backerCountAtSupport: number | null;
  backerNumber: number | null;
}

// WHEN YOU JOINED THE JOURNEY lines, from the just-written
// backing_moments row. Only real snapshot values are rendered.
export function buildJourneyLines(m: MomentSnapshotInput): string[] {
  const lines: string[] = [];
  const parts: string[] = [];
  if (m.rankAtSupport != null) parts.push(`ranked #${m.rankAtSupport}`);
  if (m.totalCreditsAtSupport != null)
    parts.push(`${m.totalCreditsAtSupport.toLocaleString()} Credits`);
  if (m.backerCountAtSupport != null)
    parts.push(`${m.backerCountAtSupport.toLocaleString()} backers`);
  if (parts.length > 0) lines.push(`When you joined: ${parts.join(" · ")}`);
  if (m.backerNumber != null)
    lines.push(`You became Backer #${m.backerNumber}`);
  return lines;
}
