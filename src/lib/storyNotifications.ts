import type { MilestoneType } from "@/db/milestones";

// Phase 5.5 (§8 / §14 of the Support Story directive): story-framed
// milestone notification templates.
//
// Pure copy builders over real data — unit-tested in
// scripts/smoke-phase5.5-thanks.ts. Rules (non-negotiable):
//  - credits-only facts, never fiat;
//  - "you were there early" ONLY when the Early Backer award logic
//    proved it (the award recipient's first moment predates the
//    crossing; WHEN, never HOW MUCH);
//  - THEN→NOW uses real ranks; an unknown rank degrades gracefully —
//    never fabricated;
//  - no causal claims ("during the climb", never "you moved her");
//  - no "support again" pressure copy.

export interface BackerMilestoneStoryInput {
  profileName: string;
  milestoneType: MilestoneType;
  /** Recipient's FIRST backing moment rank (immutable 5.1 snapshot). */
  rankAtSupport: number | null;
  /** Nominee's rank when the milestone event fired. */
  rankAtEvent: number | null;
  /**
   * True only for Early Backer award recipients of this event — the
   * award itself is the proof, so "you were there early" is safe.
   */
  provenEarly: boolean;
  /**
   * backers_50 only: the recipient is provably among the earliest 50
   * first-moment holders (ordered by supported_at). Caveat: supporters
   * from before moment capture (pre-5.1) have no moment row, so on
   * boards with ancient history this means "earliest 50 tracked
   * backers".
   */
  amongFirstBackers: boolean;
}

export interface StoryNotificationCopy {
  title: string;
  body: string;
}

const ENTRY_TYPES = new Set<MilestoneType>([
  "entered_top_50",
  "entered_top_20",
  "entered_top_10",
  "reached_3",
  "reached_1",
]);

const ENTRY_LABELS: Record<string, string> = {
  entered_top_50: "entered the Top 50",
  entered_top_20: "entered the Top 20",
  entered_top_10: "entered the Top 10",
  reached_3: "reached #3",
  reached_1: "reached #1",
};

// "You backed Mia at #23. Mia is now #3." — both ranks real. Either
// unknown degrades gracefully instead of inventing a number.
export function buildThenNowLine(
  name: string,
  rankAtSupport: number | null,
  rankAtEvent: number | null
): string {
  const thenBit =
    rankAtSupport === null
      ? `You backed ${name} before ${name} was even ranked`
      : `You backed ${name} at #${rankAtSupport}`;
  if (rankAtEvent === null) return `${thenBit}.`;
  return `${thenBit}. ${name} is now #${rankAtEvent}.`;
}

// The Early Backer award notification, story-framed. Called ONLY for
// award recipients, so "you were there early" is always data-proven,
// never a guess.
export function buildEarlyBackerStoryCopy(
  input: BackerMilestoneStoryInput
): StoryNotificationCopy {
  const { profileName, milestoneType, rankAtSupport, rankAtEvent } = input;
  const label = ENTRY_LABELS[milestoneType] ?? "hit a milestone";
  return {
    title: `🏆 ${profileName} ${label} — you were there early`,
    body:
      `${buildThenNowLine(profileName, rankAtSupport, rankAtEvent)} ` +
      `Your judgement called it early — this one's on the record.`,
  };
}

// The per-backer self-notification for a milestone event. Goes to the
// backer themselves (private moments included — self-notification is
// NOT exposure).
export function buildBackerMilestoneCopy(
  input: BackerMilestoneStoryInput
): StoryNotificationCopy {
  const {
    profileName,
    milestoneType,
    rankAtSupport,
    rankAtEvent,
    amongFirstBackers,
  } = input;
  const thenNow = buildThenNowLine(profileName, rankAtSupport, rankAtEvent);

  if (ENTRY_TYPES.has(milestoneType)) {
    const label = ENTRY_LABELS[milestoneType] ?? "hit a milestone";
    return {
      title: `${profileName} just ${label} 🎉`,
      body: thenNow,
    };
  }
  if (milestoneType === "backers_50") {
    return {
      title: `${profileName} just welcomed her 50th backer 🎉`,
      body: amongFirstBackers ? `You were one of the first. ${thenNow}` : thenNow,
    };
  }
  if (milestoneType === "first_1k_credits") {
    return {
      title: `${profileName} just passed 1,000 Support Credits`,
      body: `${thenNow} You were there for the climb.`,
    };
  }
  if (milestoneType === "credits_10k") {
    return {
      title: `${profileName} just passed 10,000 Support Credits`,
      body: `${thenNow} You were there for the climb.`,
    };
  }
  // Unknown future types: neutral, factual, no invention.
  return {
    title: `${profileName} hit a milestone 🎉`,
    body: thenNow,
  };
}

// Thank-my-early-backers preset (§16): fixed copy — custom thank-you
// text is NOT supported until a moderation pipeline exists. The
// recipient is always the backer themselves; the copy never names
// anyone else, and never contains the word "private".
export function buildNomineeThanksCopy(
  profileName: string
): StoryNotificationCopy {
  return {
    title: `❤️ ${profileName} thanked her early backers`,
    body: `You were one of them. Your early backing mattered — person to person.`,
  };
}
