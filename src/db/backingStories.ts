import { db } from "./client";
import { notSeedClause, activeUserClause } from "./visibility";
import { getMostSupported } from "./leaderboards";
import type { GrowthStage } from "@/lib/supportReasons";

// Phase 5.3 (Support Story & Backing Journey): My Backing Stories data
// layer — THEN → NOW story cards from backing_moments.
//
// Privacy contract (integration plan §5, points 1/2/7/8/9):
//  - The OWNER sees all their moments. Any other viewer sees only
//    moments whose READ-TIME effective visibility is 'public':
//      COALESCE(credit_transactions.visibility, users.show_supports)
//    `backing_moments.visibility_at_support` is AUDIT-ONLY and is never
//    consulted in the render path — a later flip to Private hides
//    previously-public stories retroactively, with no backfill.
//  - Custom reason text (support_reason_text) is returned ONLY to the
//    owner. Preset keys are public-safe.
//  - seed_community_* accounts are excluded from every story query.
//  - Pre-5.1 supports (conviction_records with no moments) render as
//    lightweight legacy entries WITHOUT fabricated snapshot fields —
//    no invented rank/credits/backers, ever.

export interface MomentStory {
  kind: "moment";
  id: string;
  rankingId: string;
  rankingTitle: string;
  profileId: string;
  profileName: string;
  profilePhotoUrl: string | null;
  supportedAt: string;
  credits: number;
  rankAtSupport: number | null;
  totalCreditsAtSupport: number | null;
  backerCountAtSupport: number | null;
  backerNumber: number | null;
  growthStageAtSupport: GrowthStage | null;
  /** Preset key (public-safe) or "custom". Null when skipped. */
  supportReason: string | null;
  /** Author-only: returned only when the viewer is the owner. */
  supportReasonText: string | null;
  currentRank: number | null;
  currentCredits: number | null;
  isPublic: boolean;
}

export interface LegacyStory {
  kind: "legacy";
  rankingId: string;
  rankingTitle: string;
  profileId: string;
  profileName: string;
  profilePhotoUrl: string | null;
  firstSupportedAt: string;
  rankAtFirstSupport: number | null;
  currentRank: number | null;
  currentCredits: number | null;
  isPublic: boolean;
}

export type BackingStory = MomentStory | LegacyStory;

interface MomentDbRow {
  id: string;
  ranking_id: string;
  ranking_title: string;
  profile_id: string;
  profile_name: string;
  profile_photo_url: string | null;
  supported_at: string;
  credits: number;
  rank_at_support: number | null;
  total_credits_at_support: number | null;
  backer_count_at_support: number | null;
  backer_number: number | null;
  growth_stage_at_support: string | null;
  support_reason: string | null;
  support_reason_text: string | null;
  eff_vis: string;
}

interface LegacyDbRow {
  ranking_id: string;
  ranking_title: string;
  profile_id: string;
  profile_name: string;
  profile_photo_url: string | null;
  first_supported_at: string;
  rank_at_first_support: number | null;
  eff_vis: string;
}

async function getMomentRows(targetUserId: string): Promise<MomentDbRow[]> {
  return (await db
    .prepare(
      `SELECT bm.id, bm.ranking_id, r.title AS ranking_title,
              bm.profile_id, p.name AS profile_name,
              p.photo_url AS profile_photo_url,
              bm.supported_at, bm.credits,
              bm.rank_at_support, bm.total_credits_at_support,
              bm.backer_count_at_support, bm.backer_number,
              bm.growth_stage_at_support,
              bm.support_reason, bm.support_reason_text,
              COALESCE(ct.visibility, u.show_supports, 'public') AS eff_vis
       FROM backing_moments bm
       JOIN users u ON u.id = bm.user_id
       LEFT JOIN credit_transactions ct ON ct.payment_id = bm.payment_id
       JOIN rankings r ON r.id = bm.ranking_id
       JOIN profiles p ON p.id = bm.profile_id
       WHERE bm.user_id = ?
         AND ${notSeedClause("u")}
         AND ${activeUserClause("u")}
         AND r.deleted_at IS NULL AND p.deleted_at IS NULL
       ORDER BY bm.supported_at DESC`
    )
    .all(targetUserId)) as unknown as MomentDbRow[];
}

// Pre-5.1 supports: a conviction record whose FIRST payment has no
// backing_moments row (moments started with the 5.1 deploy; history is
// never backfilled). Renders as a thin legacy entry — real fields only
// (first_supported_at, rank_at_first_support), never invented snapshots.
async function getLegacyRows(targetUserId: string): Promise<LegacyDbRow[]> {
  return (await db
    .prepare(
      `SELECT cr.ranking_id, r.title AS ranking_title,
              cr.profile_id, p.name AS profile_name,
              p.photo_url AS profile_photo_url,
              cr.first_supported_at, cr.rank_at_first_support,
              COALESCE(pay.visibility_choice, u.show_supports, 'public') AS eff_vis
       FROM conviction_records cr
       JOIN users u ON u.id = cr.user_id
       JOIN payments pay ON pay.id = cr.first_payment_id
       JOIN rankings r ON r.id = cr.ranking_id
       JOIN profiles p ON p.id = cr.profile_id
       WHERE cr.user_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM backing_moments bm
           WHERE bm.payment_id = cr.first_payment_id
         )
         AND ${notSeedClause("u")}
         AND ${activeUserClause("u")}
         AND r.deleted_at IS NULL AND p.deleted_at IS NULL
       ORDER BY cr.first_supported_at DESC`
    )
    .all(targetUserId)) as unknown as LegacyDbRow[];
}

// Live NOW read per distinct ranking (same one-board-per-ranking
// pattern as getPeopleIBack — fine at profile scale).
async function currentByRanking(
  rankingIds: string[]
): Promise<Map<string, Map<string, { rank: number; credits: number }>>> {
  const out = new Map<string, Map<string, { rank: number; credits: number }>>();
  for (const rankingId of rankingIds) {
    const board = await getMostSupported(rankingId);
    const m = new Map<string, { rank: number; credits: number }>();
    board.forEach((entry, idx) =>
      m.set(entry.profile.id, {
        rank: idx + 1,
        credits: entry.supportScore,
      })
    );
    out.set(rankingId, m);
  }
  return out;
}

export async function getBackingStories(
  viewerId: string | null,
  targetUserId: string
): Promise<BackingStory[]> {
  const isOwner = viewerId !== null && viewerId === targetUserId;
  const [momentRows, legacyRows] = await Promise.all([
    getMomentRows(targetUserId),
    getLegacyRows(targetUserId),
  ]);

  const visibleMoments = momentRows.filter(
    (r) => isOwner || r.eff_vis === "public"
  );
  const visibleLegacy = legacyRows.filter(
    (r) => isOwner || r.eff_vis === "public"
  );

  const rankingIds = [
    ...new Set([
      ...visibleMoments.map((r) => r.ranking_id),
      ...visibleLegacy.map((r) => r.ranking_id),
    ]),
  ];
  const nowByRanking = await currentByRanking(rankingIds);

  const stories: BackingStory[] = [];

  for (const r of visibleMoments) {
    const now = nowByRanking.get(r.ranking_id)?.get(r.profile_id) ?? null;
    stories.push({
      kind: "moment",
      id: r.id,
      rankingId: r.ranking_id,
      rankingTitle: r.ranking_title,
      profileId: r.profile_id,
      profileName: r.profile_name,
      profilePhotoUrl: r.profile_photo_url,
      supportedAt: r.supported_at,
      credits: r.credits,
      rankAtSupport: r.rank_at_support,
      totalCreditsAtSupport: r.total_credits_at_support,
      backerCountAtSupport: r.backer_count_at_support,
      backerNumber: r.backer_number,
      growthStageAtSupport: (r.growth_stage_at_support ??
        null) as GrowthStage | null,
      supportReason: r.support_reason,
      // Author-only: viewers never receive custom text.
      supportReasonText: isOwner ? r.support_reason_text : null,
      currentRank: now?.rank ?? null,
      currentCredits: now?.credits ?? null,
      isPublic: r.eff_vis === "public",
    });
  }

  for (const r of visibleLegacy) {
    const now = nowByRanking.get(r.ranking_id)?.get(r.profile_id) ?? null;
    stories.push({
      kind: "legacy",
      rankingId: r.ranking_id,
      rankingTitle: r.ranking_title,
      profileId: r.profile_id,
      profileName: r.profile_name,
      profilePhotoUrl: r.profile_photo_url,
      firstSupportedAt: r.first_supported_at,
      rankAtFirstSupport: r.rank_at_first_support,
      currentRank: now?.rank ?? null,
      currentCredits: now?.credits ?? null,
      isPublic: r.eff_vis === "public",
    });
  }

  // Newest first, moments and legacy entries interleaved by date.
  stories.sort((a, b) => {
    const da = a.kind === "moment" ? a.supportedAt : a.firstSupportedAt;
    const dbb = b.kind === "moment" ? b.supportedAt : b.firstSupportedAt;
    return dbb.localeCompare(da);
  });

  return stories;
}

// ── People I Back v2 enrichment ──────────────────────────────────────
// Per-person story enrichment from the triple's moments:
//  - latestReason: newest preset key, visibility-gated for viewers
//    (private moments contribute only for the owner; custom text
//    never leaves the author — see getBackingStories).
//  - firstGrowthStage: growth stage of the FIRST tracked moment
//    (the "journey from" anchor). Null when the triple predates 5.1 —
//    callers fall back to growthStageForRank(rankAtFirstSupport).
export interface PersonStoryEnrichment {
  latestReason: string | null;
  /** Author-only: the free-text reason of the latest support, owner only. */
  latestReasonText: string | null;
  firstGrowthStage: GrowthStage | null;
}

export async function getPersonStoryEnrichment(
  viewerId: string | null,
  targetUserId: string,
  rankingId: string,
  profileId: string
): Promise<PersonStoryEnrichment> {
  const isOwner = viewerId !== null && viewerId === targetUserId;
  const rows = (await db
    .prepare(
      `SELECT bm.support_reason, bm.support_reason_text,
              bm.growth_stage_at_support,
              COALESCE(ct.visibility, u.show_supports, 'public') AS eff_vis
       FROM backing_moments bm
       JOIN users u ON u.id = bm.user_id
       LEFT JOIN credit_transactions ct ON ct.payment_id = bm.payment_id
       WHERE bm.user_id = ? AND bm.ranking_id = ? AND bm.profile_id = ?
         AND ${notSeedClause("u")}
       ORDER BY bm.supported_at ASC`
    )
    .all(targetUserId, rankingId, profileId)) as unknown as {
    support_reason: string | null;
    support_reason_text: string | null;
    growth_stage_at_support: string | null;
    eff_vis: string;
  }[];

  if (rows.length === 0)
    return { latestReason: null, latestReasonText: null, firstGrowthStage: null };

  const visible = rows.filter((r) => isOwner || r.eff_vis === "public");
  // Viewers derive the journey anchor only from moments they can see —
  // no private-moment-derived data ever reaches a non-owner.
  const base = isOwner ? rows : visible;
  const latest = visible.length > 0 ? visible[visible.length - 1] : null;
  return {
    latestReason: latest?.support_reason ?? null,
    // Author-only: viewers never receive custom text.
    latestReasonText: isOwner ? (latest?.support_reason_text ?? null) : null,
    firstGrowthStage: (base.length > 0 ? base[0].growth_stage_at_support : null) as GrowthStage | null,
  };
}
