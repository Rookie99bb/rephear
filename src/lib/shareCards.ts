import { findProfileById } from "@/db/profiles";
import { findRankingById } from "@/db/rankings";
import {
  getSupportedBoardState,
  getMilestoneEvents,
  type MilestoneEvent,
} from "@/db/milestones";
import { getMovement } from "@/db/rankingSnapshots";
import { findCampaignLinkByProfileAndRanking } from "@/db/campaignLinks";
import { getSiteUrl } from "@/lib/siteUrl";

// Phase 4 (nominee growth loop): milestone share cards.
//
// Cards are nominee-facing ("I'm…" voice) and exist ONLY as a growth
// loop for claimed nominees: claim → milestone → card → share → /s/
// attribution → new users. Every card traces to a milestone_events row
// or a live leaderboard read at generation time — no event (and no
// live data), no card. Nothing is ever fabricated.
//
// Server-side gating (never UI-only):
//   1. profile exists and belongs to the ranking,
//   2. profile.claim_status = 'claimed' (anti-impersonation),
//   3. the viewer IS the claiming user (claimed_by) — the PNG route and
//      the share page both enforce this,
//   4. at least one milestone_events row (the milestone system has seen
//      this nominee),
//   5. type-specific data actually available (see below).

export const SHARE_CARD_TYPES = ["rank", "top10", "backers", "rising"] as const;
export type ShareCardType = (typeof SHARE_CARD_TYPES)[number];

export const SHARE_CARD_SIZE = 1080; // 1:1 per AGENTS.md poster standard

export interface ShareCardData {
  type: ShareCardType;
  cardTitle: string; // short label for UI ("I'm #7 in X")
  rankingId: string;
  rankingTitle: string;
  profileId: string;
  profileName: string;
  photoUrl: string | null;
  headline: string; // big line, e.g. "I'm #7"
  subline: string; // context line, e.g. "in London's Best DJ 2026"
  statLine: string; // "2,860 Support Credits • 41 backers"
  cta: string; // "Support Mia on RepHear"
  deepLink: string; // absolute URL printed on the card
  deepLinkLabel: string; // host + path, no scheme
  generatedLabel: string; // "as of 30 Sep 2026" — data frozen at generation
}

export type ShareCardDenial =
  | "not_found"
  | "not_claimed"
  | "not_owner"
  | "no_milestones"
  | "unavailable";

export type ShareCardResult =
  | { ok: true; data: ShareCardData }
  | { ok: false; reason: ShareCardDenial };

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function generatedLabel(): string {
  return `as of ${new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

// Deep link for a card: the /s/ short link when one exists (attribution
// + pretty), otherwise the /n/TOKEN nominee landing page. Both resolve
// to the nominee — verified by the smoke test.
export async function getNomineeDeepLink(
  rankingId: string,
  profileId: string,
  shareToken: string | null
): Promise<{ url: string; label: string }> {
  const site = getSiteUrl();
  const link = await findCampaignLinkByProfileAndRanking(profileId, rankingId);
  if (link) {
    return {
      url: `${site}/s/${link.slug}`,
      label: `${site.replace(/^https?:\/\//, "")}/s/${link.slug}`,
    };
  }
  const token = shareToken ?? "";
  return {
    url: `${site}/n/${token}`,
    label: `${site.replace(/^https?:\/\//, "")}/n/${token}`,
  };
}

function findEvent(
  events: MilestoneEvent[],
  type: MilestoneEvent["type"]
): MilestoneEvent | undefined {
  return events.find((e) => e.type === type);
}

export async function getShareCardData(params: {
  rankingId: string;
  profileId: string;
  type: ShareCardType;
  viewerUserId: string | null;
}): Promise<ShareCardResult> {
  const { rankingId, profileId, type, viewerUserId } = params;

  const profile = await findProfileById(profileId);
  if (!profile || profile.rankingId !== rankingId) {
    return { ok: false, reason: "not_found" };
  }
  if (profile.claimStatus !== "claimed" || !profile.claimedBy) {
    return { ok: false, reason: "not_claimed" };
  }
  if (viewerUserId !== profile.claimedBy) {
    return { ok: false, reason: "not_owner" };
  }

  const ranking = await findRankingById(rankingId);
  const rankingTitle = ranking?.title ?? "this ranking";

  const events = await getMilestoneEvents(rankingId, profileId);
  if (events.length === 0) {
    return { ok: false, reason: "no_milestones" };
  }

  const deep = await getNomineeDeepLink(rankingId, profileId, profile.shareToken);
  const base = {
    rankingId,
    rankingTitle,
    profileId,
    profileName: profile.name,
    photoUrl: profile.photoUrl || null,
    cta: `Support ${profile.name} on RepHear`,
    deepLink: deep.url,
    deepLinkLabel: deep.label,
    generatedLabel: generatedLabel(),
  };

  if (type === "rank") {
    // Live leaderboard read, frozen at generation time.
    const board = await getSupportedBoardState(rankingId);
    const row = board.find((r) => r.profileId === profileId);
    if (!row) return { ok: false, reason: "unavailable" };
    return {
      ok: true,
      data: {
        ...base,
        type,
        cardTitle: `I'm #${row.rank} in ${rankingTitle}`,
        headline: `I'm #${row.rank}`,
        subline: `in ${rankingTitle}`,
        statLine: `${fmt(row.totalCredits)} Support Credits • ${fmt(row.backerCount)} backers`,
      },
    };
  }

  if (type === "top10") {
    const event = findEvent(events, "entered_top_10");
    if (!event) return { ok: false, reason: "unavailable" };
    return {
      ok: true,
      data: {
        ...base,
        type,
        cardTitle: `Top 10 in ${rankingTitle}`,
        headline: "Top 10 🎉",
        subline: `${profile.name} in ${rankingTitle}`,
        statLine: `${fmt(event.creditsAtEvent ?? 0)} Support Credits • ${fmt(event.backersAtEvent ?? 0)} backers`,
      },
    };
  }

  if (type === "backers") {
    // The backers_50 event proves the milestone was reached; the card
    // shows the LIVE backer count frozen at generation (labeled as such).
    const event = findEvent(events, "backers_50");
    if (!event) return { ok: false, reason: "unavailable" };
    const board = await getSupportedBoardState(rankingId);
    const row = board.find((r) => r.profileId === profileId);
    if (!row) return { ok: false, reason: "unavailable" };
    return {
      ok: true,
      data: {
        ...base,
        type,
        cardTitle: `${fmt(row.backerCount)} backers`,
        headline: `${fmt(row.backerCount)} backers ❤️`,
        subline: `believe in ${profile.name}`,
        statLine: `${fmt(row.totalCredits)} Support Credits in ${rankingTitle}`,
      },
    };
  }

  // type === "rising": real snapshot movement only — climbed 2+ spots or
  // brand-new entry between the last two daily snapshots. Fewer than two
  // snapshots → no data → no card (never inferred).
  const movement = await getMovement(rankingId, "supported");
  const m = movement.get(profileId);
  if (
    !m ||
    !((m.direction === "up" && m.delta >= 2) || m.direction === "new")
  ) {
    return { ok: false, reason: "unavailable" };
  }
  const board = await getSupportedBoardState(rankingId);
  const row = board.find((r) => r.profileId === profileId);
  if (!row) return { ok: false, reason: "unavailable" };
  const riseLabel =
    m.direction === "new"
      ? "just joined the board"
      : `up ${m.delta} spots this week`;
  return {
    ok: true,
    data: {
      ...base,
      type,
      cardTitle: `Rising in ${rankingTitle}`,
      headline: "Rising ↗",
      subline: `${riseLabel} — now #${row.rank} in ${rankingTitle}`,
      statLine: `${fmt(row.totalCredits)} Support Credits • ${fmt(row.backerCount)} backers`,
    },
  };
}

// Cards available to the claiming owner right now (for the share-page
// UI). Server-side: only the owner ever sees this list.
export async function getAvailableShareCards(params: {
  rankingId: string;
  profileId: string;
  viewerUserId: string;
}): Promise<ShareCardData[]> {
  const out: ShareCardData[] = [];
  for (const type of SHARE_CARD_TYPES) {
    const result = await getShareCardData({ ...params, type });
    if (result.ok) out.push(result.data);
  }
  return out;
}
