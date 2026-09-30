// Phase 5.6: backer story cards — Early Backer / Milestone / Journey.
//
// These cards belong to the SUPPORTER (unlike Phase 4's nominee cards):
// "You backed Mia at #23. She's now #3." Every number traces to a real
// backing_moments row, a real milestone_events row, or a live board read
// — nothing is ever fabricated, and no causal claim is ever made (two
// facts side by side, never "you moved her").
//
// Public vs private (server-side, never UI-only):
//   - A backer whose EFFECTIVE backing visibility is public gets a
//     normal shareable card URL.
//   - A private backer's card only ever renders behind a signed,
//     non-enumerable, author-only URL (storyCardTokens.ts) with noindex.
//     The card names nobody but shows only the author's own moment data;
//     a private backer's existence never leaks to anyone else.
//   - Read-time effective visibility governs: COALESCE(latest
//     credit_transaction.visibility, users.show_supports, 'public').
//     visibility_at_support is audit-only and is never read for display.
//     Unknown → private (fail closed).
//   - Custom reason text (support_reason_text) is author-only: it renders
//     only on the author's own signed card, never on a public card.
//     Public preset reasons may render on public cards.
//   - Seed accounts are excluded from every data source.

import { db } from "@/db/client";
import { findProfileById } from "@/db/profiles";
import { findRankingById } from "@/db/rankings";
import {
  EARLY_BACKER_THRESHOLDS,
  getEarlyBackerAwards,
  getMilestoneEvents,
  getSupportedBoardState,
  type MilestoneEvent,
} from "@/db/milestones";
import {
  activeUserClause,
  effectiveVisibility,
  isVisibility,
  notSeedClause,
  type Visibility,
} from "@/db/visibility";
import {
  getNomineeDeepLink,
  type ShareCardData,
} from "./shareCards";
import {
  createStoryCardToken,
} from "./storyCardTokens";
import {
  buildMilestoneLabel,
  formatStoryDate,
  resolveStoryReasonEcho,
} from "./storyCopy";
import { SUPPORT_REASON_CUSTOM } from "./supportReasons";
import { getSiteUrl } from "./siteUrl";

export const STORY_CARD_TYPES = [
  "early-backer",
  "milestone",
  "journey",
] as const;
export type StoryCardType = (typeof STORY_CARD_TYPES)[number];

// Same shape as Phase 4's ShareCardData so renderShareCardPng needs no
// fork — the renderer is data-agnostic (headline/subline/statLine).
export type StoryCardData = Omit<ShareCardData, "type"> & {
  type: StoryCardType;
};

export type StoryCardDenial =
  | "not_found" // profile/ranking missing or mismatched
  | "not_backer" // requester has no backing moment for this nominee
  | "no_award" // early-backer card without an Early Backer award (no proof)
  | "no_milestone" // milestone id not a real milestone_events row
  | "unavailable" // no data to render honestly (e.g. empty journey)
  | "unsigned"; // private card requested without a valid signed URL

export type StoryCardResult =
  | { ok: true; data: StoryCardData; visibility: Visibility }
  | { ok: false; reason: StoryCardDenial };

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

interface FirstMomentRow {
  rank_at_support: number | null;
  supported_at: string;
  support_reason: string | null;
  support_reason_text: string | null;
  credits: number;
}

// The requester's earliest backing moment for (ranking, nominee) — the
// THEN in every THEN→NOW story. Reads the immutable Phase 5.1 snapshot.
async function getUserFirstMoment(
  userId: string,
  rankingId: string,
  profileId: string
): Promise<FirstMomentRow | null> {
  const row = (await db
    .prepare(
      `SELECT bm.rank_at_support AS rank_at_support,
              bm.supported_at AS supported_at,
              bm.support_reason AS support_reason,
              bm.support_reason_text AS support_reason_text,
              bm.credits AS credits
       FROM backing_moments bm
       JOIN users u ON u.id = bm.user_id
       WHERE bm.user_id = ? AND bm.ranking_id = ? AND bm.profile_id = ?
         AND ${notSeedClause("u")}
         AND ${activeUserClause("u")}
       ORDER BY bm.supported_at ASC
       LIMIT 1`
    )
    .get(userId, rankingId, profileId)) as unknown as
    | FirstMomentRow
    | undefined;
  return row ?? null;
}

async function getMilestoneEventById(
  id: string,
  rankingId: string,
  profileId: string
): Promise<MilestoneEvent | null> {
  const row = (await db
    .prepare(
      `SELECT id, ranking_id, profile_id, type,
              rank_at_event, credits_at_event, backers_at_event, created_at
       FROM milestone_events
       WHERE id = ? AND ranking_id = ? AND profile_id = ?`
    )
    .get(id, rankingId, profileId)) as unknown as
    | {
        id: string;
        ranking_id: string;
        profile_id: string;
        type: string;
        rank_at_event: number | null;
        credits_at_event: number | null;
        backers_at_event: number | null;
        created_at: string;
      }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    rankingId: row.ranking_id,
    profileId: row.profile_id,
    type: row.type as MilestoneEvent["type"],
    rankAtEvent: row.rank_at_event,
    creditsAtEvent: row.credits_at_event,
    backersAtEvent: row.backers_at_event,
    createdAt: row.created_at,
  };
}

// Read-time effective visibility of this user's backing for this
// nominee: the latest transaction's choice, else the account default,
// else public. Unknown (no transactions found) → private: fail closed.
async function getBackingEffectiveVisibility(
  userId: string,
  rankingId: string,
  profileId: string
): Promise<Visibility> {
  const row = (await db
    .prepare(
      `SELECT ct.visibility AS v, u.show_supports AS def
       FROM credit_transactions ct
       JOIN users u ON u.id = ct.supporter_user_id
       WHERE ct.supporter_user_id = ? AND ct.ranking_id = ? AND ct.profile_id = ?
       ORDER BY ct.created_at DESC
       LIMIT 1`
    )
    .get(userId, rankingId, profileId)) as unknown as
    | { v: string | null; def: string | null }
    | undefined;
  if (!row) return "private";
  return effectiveVisibility(row.v, isVisibility(row.def) ? row.def : "public");
}

// Preset reason echo is public-safe; custom free text is author-only.
function reasonEchoForCard(params: {
  reason: string | null;
  reasonText: string | null;
  privateView: boolean;
}): string | null {
  const { reason, reasonText, privateView } = params;
  if (!reason) return null;
  if (reason === SUPPORT_REASON_CUSTOM && !privateView) return null;
  return resolveStoryReasonEcho(reason, reasonText);
}

// Most prestigious award first (reached_1 > reached_3 > top_10 > ...).
function pickBestAward(
  awards: { milestoneType: string; awardedAt: string }[]
): { milestoneType: string; awardedAt: string } | null {
  if (awards.length === 0) return null;
  return [...awards].sort((a, b) => {
    const ta = EARLY_BACKER_THRESHOLDS[a.milestoneType] ?? 999;
    const tb = EARLY_BACKER_THRESHOLDS[b.milestoneType] ?? 999;
    return ta - tb;
  })[0];
}

const AWARD_LABEL: Record<string, string> = {
  entered_top_50: "Top 50",
  entered_top_20: "Top 20",
  entered_top_10: "Top 10",
  reached_3: "#3",
  reached_1: "#1",
};

async function earlyBackerCard(params: {
  rankingId: string;
  profileId: string;
  viewerUserId: string;
  privateView: boolean;
}): Promise<StoryCardResult> {
  const { rankingId, profileId, viewerUserId, privateView } = params;
  const profile = await findProfileById(profileId);
  if (!profile || profile.rankingId !== rankingId) {
    return { ok: false, reason: "not_found" };
  }
  const first = await getUserFirstMoment(viewerUserId, rankingId, profileId);
  if (!first) return { ok: false, reason: "not_backer" };

  // The Early Backer award IS the data proof — no award, no card.
  const awards = (await getEarlyBackerAwards(viewerUserId)).filter(
    (a) => a.rankingId === rankingId && a.profileId === profileId
  );
  const award = pickBestAward(awards);
  if (!award) return { ok: false, reason: "no_award" };

  const ranking = await findRankingById(rankingId);
  const rankingTitle = ranking?.title ?? "this ranking";
  const board = await getSupportedBoardState(rankingId);
  const row = board.find((r) => r.profileId === profileId);
  if (!row) return { ok: false, reason: "unavailable" };

  const thenRank = first.rank_at_support;
  const nowRank = row.rank;
  const awardLabel = AWARD_LABEL[award.milestoneType] ?? "an early milestone";

  // THEN→NOW: two real facts side by side — never "you moved her".
  let subline: string;
  if (thenRank != null) {
    subline =
      nowRank < thenRank
        ? `I backed ${profile.name} at #${thenRank} — now #${nowRank}`
        : `I backed ${profile.name} at #${thenRank} (now #${nowRank})`;
  } else {
    subline = `I backed ${profile.name} before she was ranked — now #${nowRank}`;
  }

  const echo = reasonEchoForCard({
    reason: first.support_reason,
    reasonText: first.support_reason_text,
    privateView,
  });
  const backedDate = formatStoryDate(first.supported_at);
  const statLine =
    `Early Backer • ${awardLabel}` +
    (backedDate ? ` • backed ${backedDate}` : "") +
    (echo ? ` • ${echo}` : "");

  const deep = await getNomineeDeepLink(rankingId, profileId, profile.shareToken);
  const visibility = await getBackingEffectiveVisibility(
    viewerUserId,
    rankingId,
    profileId
  );
  return {
    ok: true,
    visibility,
    data: {
      type: "early-backer",
      cardTitle: `Early Backer of ${profile.name}`,
      rankingId,
      rankingTitle,
      profileId,
      profileName: profile.name,
      photoUrl: profile.photoUrl || null,
      headline: "I Was There Early",
      subline,
      statLine,
      cta: `Back ${profile.name} on RepHear`,
      deepLink: deep.url,
      deepLinkLabel: deep.label,
      generatedLabel: generatedLabel(),
    },
  };
}

async function milestoneCard(params: {
  rankingId: string;
  profileId: string;
  milestoneId: string;
  viewerUserId: string;
  privateView: boolean;
}): Promise<StoryCardResult> {
  const { rankingId, profileId, milestoneId, viewerUserId, privateView } = params;
  // The milestone must be a REAL milestone_events row — a fabricated id
  // is a 404, never a card.
  const event = await getMilestoneEventById(milestoneId, rankingId, profileId);
  if (!event) return { ok: false, reason: "no_milestone" };
  const profile = await findProfileById(profileId);
  if (!profile || profile.rankingId !== rankingId) {
    return { ok: false, reason: "not_found" };
  }
  const first = await getUserFirstMoment(viewerUserId, rankingId, profileId);
  if (!first) return { ok: false, reason: "not_backer" };

  const ranking = await findRankingById(rankingId);
  const rankingTitle = ranking?.title ?? "this ranking";
  const label = buildMilestoneLabel(event.type, event.rankAtEvent);

  // "I was there early" only when the timestamps prove it.
  const wasEarly =
    first.supported_at < event.createdAt;
  const backedDate = formatStoryDate(first.supported_at);
  const subline = wasEarly
    ? `I backed ${profile.name} before this — join the story`
    : `I backed ${profile.name}${backedDate ? ` on ${backedDate}` : ""}`;

  const echo = reasonEchoForCard({
    reason: first.support_reason,
    reasonText: first.support_reason_text,
    privateView,
  });
  const statLine =
    `${fmt(event.creditsAtEvent ?? 0)} Support Credits • ${fmt(event.backersAtEvent ?? 0)} backers` +
    (echo ? ` • ${echo}` : "");

  const deep = await getNomineeDeepLink(rankingId, profileId, profile.shareToken);
  const visibility = await getBackingEffectiveVisibility(
    viewerUserId,
    rankingId,
    profileId
  );
  return {
    ok: true,
    visibility,
    data: {
      type: "milestone",
      cardTitle: `${profile.name}: ${label}`,
      rankingId,
      rankingTitle,
      profileId,
      profileName: profile.name,
      photoUrl: profile.photoUrl || null,
      headline: label,
      subline,
      statLine,
      cta: `Back ${profile.name} on RepHear`,
      deepLink: deep.url,
      deepLinkLabel: deep.label,
      generatedLabel: generatedLabel(),
    },
  };
}

interface JourneyRow {
  ranking_id: string;
  profile_id: string;
  first_at: string;
  credits: number;
}

async function journeyCard(params: {
  viewerUserId: string;
  privateView: boolean;
}): Promise<StoryCardResult> {
  const { viewerUserId } = params;
  const rows = (await db
    .prepare(
      `SELECT bm.ranking_id AS ranking_id,
              bm.profile_id AS profile_id,
              MIN(bm.supported_at) AS first_at,
              SUM(bm.credits) AS credits
       FROM backing_moments bm
       JOIN users u ON u.id = bm.user_id
       WHERE bm.user_id = ?
         AND ${notSeedClause("u")}
         AND ${activeUserClause("u")}
       GROUP BY bm.ranking_id, bm.profile_id`
    )
    .all(viewerUserId)) as unknown as JourneyRow[];
  if (rows.length === 0) return { ok: false, reason: "unavailable" };

  // "entered the Top 10 after I joined": provable via timestamps only.
  let climbed = 0;
  for (const r of rows) {
    const hit = (await db
      .prepare(
        `SELECT 1 AS one FROM milestone_events
         WHERE ranking_id = ? AND profile_id = ?
           AND type = 'entered_top_10'
           AND created_at > ?
         LIMIT 1`
      )
      .get(r.ranking_id, r.profile_id, r.first_at)) as unknown as
      | { one: number }
      | undefined;
    if (hit) climbed++;
  }

  const people = rows.length;
  const rankings = new Set(rows.map((r) => r.ranking_id)).size;
  const totalCredits = rows.reduce((s, r) => s + (r.credits ?? 0), 0);
  const year = new Date().getFullYear();

  // The journey card's own visibility comes from the account default —
  // the backer's moments may span mixed visibilities, so the default
  // governs whether this aggregate may be shared unsigned.
  const defRow = (await db
    .prepare(`SELECT show_supports AS def FROM users WHERE id = ?`)
    .get(viewerUserId)) as unknown as { def: string | null } | undefined;
  const visibility: Visibility = isVisibility(defRow?.def)
    ? defRow.def
    : "public";

  const site = getSiteUrl();
  return {
    ok: true,
    visibility,
    data: {
      type: "journey",
      cardTitle: "My Backing Journey",
      rankingId: "",
      rankingTitle: "",
      profileId: "",
      profileName: "Backing Journey",
      photoUrl: null,
      headline: "My Backing Journey",
      subline:
        `${year} so far: I backed ${fmt(people)} ` +
        `${people === 1 ? "person" : "people"} — ` +
        `${fmt(climbed)} entered the Top 10 after I joined`,
      statLine: `${fmt(totalCredits)} Support Credits • ${fmt(rankings)} ${rankings === 1 ? "ranking" : "rankings"}`,
      cta: "Start your journey on RepHear",
      deepLink: site,
      deepLinkLabel: site.replace(/^https?:\/\//, ""),
      generatedLabel: generatedLabel(),
    },
  };
}

export async function getStoryCardData(params: {
  type: StoryCardType;
  rankingId?: string;
  profileId?: string;
  milestoneId?: string;
  viewerUserId: string;
  // True when the request arrived over a verified signed URL (the
  // author-only path). Private cards REQUIRE this; public cards don't.
  signed: boolean;
}): Promise<StoryCardResult> {
  const { type, rankingId, profileId, milestoneId, viewerUserId, signed } =
    params;

  let result: StoryCardResult;
  if (type === "early-backer") {
    if (!rankingId || !profileId) return { ok: false, reason: "not_found" };
    result = await earlyBackerCard({
      rankingId,
      profileId,
      viewerUserId,
      privateView: signed,
    });
  } else if (type === "milestone") {
    if (!rankingId || !profileId || !milestoneId) {
      return { ok: false, reason: "not_found" };
    }
    result = await milestoneCard({
      rankingId,
      profileId,
      milestoneId,
      viewerUserId,
      privateView: signed,
    });
  } else {
    result = await journeyCard({ viewerUserId, privateView: signed });
  }

  if (!result.ok) return result;
  // Private backers: only the signed, author-only path renders.
  if (result.visibility === "private" && !signed) {
    return { ok: false, reason: "unsigned" };
  }
  return result;
}

export interface StoryCardLink {
  label: string;
  href: string;
  isPrivate: boolean; // signed author-only URL (noindex)
}

function cardHref(params: {
  type: StoryCardType;
  rankingId?: string;
  profileId?: string;
  milestoneId?: string;
  userId: string;
  isPrivate: boolean;
}): string {
  const { type, rankingId, profileId, milestoneId, userId, isPrivate } = params;
  if (!isPrivate) {
    const qs = new URLSearchParams({ type });
    if (rankingId) qs.set("rankingId", rankingId);
    if (profileId) qs.set("profileId", profileId);
    if (milestoneId) qs.set("milestoneId", milestoneId);
    return `/api/story-cards?${qs.toString()}`;
  }
  const token = createStoryCardToken({
    userId,
    type,
    rankingId: rankingId ?? null,
    profileId: profileId ?? null,
    milestoneId: milestoneId ?? null,
  });
  return `/cards/${token}`;
}

// Owner-only card inventory for the "My Story Cards" panel: early-backer
// cards (award = data proof), milestone cards for real events the owner
// backed before, and the journey card. Private cards come back as signed
// author-only URLs; public cards as plain shareable API URLs.
export async function getStoryCardLinks(
  userId: string
): Promise<StoryCardLink[]> {
  const links: StoryCardLink[] = [];

  const awards = await getEarlyBackerAwards(userId);
  const seenPairs = new Set<string>();
  for (const a of awards) {
    const key = `${a.rankingId}:${a.profileId}`;
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    const result = await getStoryCardData({
      type: "early-backer",
      rankingId: a.rankingId,
      profileId: a.profileId,
      viewerUserId: userId,
      signed: true,
    });
    if (!result.ok) continue;
    links.push({
      label: result.data.cardTitle,
      isPrivate: result.visibility === "private",
      href: cardHref({
        type: "early-backer",
        rankingId: a.rankingId,
        profileId: a.profileId,
        userId,
        isPrivate: result.visibility === "private",
      }),
    });
  }

  // Milestone cards: real events on nominees this user backed. Bounded:
  // 3 most recent events per (ranking, profile), 12 links total.
  const pairs = (await db
    .prepare(
      `SELECT DISTINCT ranking_id AS ranking_id, profile_id AS profile_id
       FROM backing_moments WHERE user_id = ?`
    )
    .all(userId)) as unknown as { ranking_id: string; profile_id: string }[];
  let milestoneLinks = 0;
  for (const pair of pairs) {
    if (milestoneLinks >= 12) break;
    const events = await getMilestoneEvents(pair.ranking_id, pair.profile_id);
    for (const event of events.slice(-3)) {
      if (milestoneLinks >= 12) break;
      const result = await getStoryCardData({
        type: "milestone",
        rankingId: pair.ranking_id,
        profileId: pair.profile_id,
        milestoneId: event.id,
        viewerUserId: userId,
        signed: true,
      });
      if (!result.ok) continue;
      milestoneLinks++;
      links.push({
        label: result.data.cardTitle,
        isPrivate: result.visibility === "private",
        href: cardHref({
          type: "milestone",
          rankingId: pair.ranking_id,
          profileId: pair.profile_id,
          milestoneId: event.id,
          userId,
          isPrivate: result.visibility === "private",
        }),
      });
    }
  }

  const journey = await getStoryCardData({
    type: "journey",
    viewerUserId: userId,
    signed: true,
  });
  if (journey.ok) {
    links.push({
      label: journey.data.cardTitle,
      isPrivate: journey.visibility === "private",
      href: cardHref({
        type: "journey",
        userId,
        isPrivate: journey.visibility === "private",
      }),
    });
  }

  return links;
}
