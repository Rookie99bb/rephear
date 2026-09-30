// Phase 5.7 (evidence-based identity engine): thresholds and copy.
// "Money enables the signal. Judgement determines the identity."
// Identities are awarded ONLY from patterns over time — never from a
// single action, never from spend. No wealth tiers, no "Top Spender",
// no "Whale", no amount-based badges: identity = WHO + WHEN + WHY +
// WHAT HAPPENED. All thresholds are tunable here with no schema change.

export const IDENTITY_ENGINE_VERSION = "v1";

export const IDENTITY_KEYS = [
  "talent_spotter",
  "underdog_backer",
  "loyal_backer",
] as const;
export type IdentityKey = (typeof IDENTITY_KEYS)[number];

export function isIdentityKey(k: string): k is IdentityKey {
  return (IDENTITY_KEYS as readonly string[]).includes(k);
}

// Starter values are deliberately modest: real users who consistently
// show judgement reach them, one-off actions never do.
interface TalentSpotterRule {
  name: string;
  emoji: string;
  minAwards: number;
  minDistinctNominees: number;
  milestoneTypes: string[];
}
interface UnderdogBackerRule {
  name: string;
  emoji: string;
  minMoments: number;
  outsideTopK: number;
  enteredTopK: number;
  minDistinctNominees: number;
}
interface LoyalBackerRule {
  name: string;
  emoji: string;
  minMoments: number;
  minMonths: number;
}
export interface IdentityRules {
  talent_spotter: TalentSpotterRule;
  underdog_backer: UnderdogBackerRule;
  loyal_backer: LoyalBackerRule;
}
export const IDENTITY_RULES: IdentityRules = {
  talent_spotter: {
    name: "Talent Spotter",
    emoji: "💎",
    // Early Backer awards (first-moment holder before a climb — WHEN,
    // never HOW MUCH) across this many distinct nominees.
    minAwards: 3,
    minDistinctNominees: 3,
    milestoneTypes: ["entered_top_10", "reached_3", "reached_1"],
  },
  underdog_backer: {
    name: "Underdog Backer",
    emoji: "🌱",
    // Backing moments where the nominee ranked worse than outsideTopK at
    // backing time AND later climbed into the Top enteredTopK.
    minMoments: 3,
    outsideTopK: 20,
    enteredTopK: 10,
    minDistinctNominees: 2,
  },
  loyal_backer: {
    name: "Loyal Backer",
    emoji: "❤️",
    // Supports for the SAME nominee spanning this many calendar months
    // (duration + consistency, not a single check-in).
    minMoments: 3,
    minMonths: 3,
  },
};

// ── Evidence summaries (one line, counts only) ─────────────────────────
// Proven-by-data, credits-only, no fiat, no causal claims ("you moved
// them" is forbidden), no private details (no names, dates, reasons).

export function talentSpotterSummary(
  awards: number,
  nominees: number
): string {
  return `Spotted ${awards} rising talents before they broke into the Top 10 — backed ${nominees} of them first.`;
}

export function underdogBackerSummary(
  moments: number,
  nominees: number,
  outsideK: number,
  enteredK: number
): string {
  return `Stood behind ${nominees} underdogs — ${moments} supports backed outside the Top ${outsideK} before their climb into the Top ${enteredK}.`;
}

export function loyalBackerSummary(moments: number, months: number): string {
  return `${moments} supports across ${months} months for one nominee — loyalty over time.`;
}

// ── Copy for the "new identity earned" notification ────────────────────
// Discovery / belonging framing only — never "Support again" pressure.

export function identityEarnedTitle(key: IdentityKey): string {
  const r = IDENTITY_RULES[key];
  return `You earned a new identity: ${r.name} ${r.emoji}`;
}

export function identityEarnedBody(summary: string): string {
  return `${summary} Your backing history tells the story.`;
}
