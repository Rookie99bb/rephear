import { db } from "./client";
import { notSeedClause, activeUserClause } from "./visibility";
import { getMilestoneEvents, type MilestoneType } from "./milestones";

// Phase 5.4 (Support Story §10/§11/§17): Journey Timeline + YOU JOINED
// HERE + Community/Road-to-Top-3 data layer.
//
// Factual-source discipline (§23): milestone_events rows are the ONLY
// source of milestone truth. No event row → no milestone rendered —
// nothing is inferred, interpolated, or fabricated. Timeline entries
// are the nominee's PUBLIC trail (credits-only facts, no fiat).
//
// Privacy contract:
//  - YOU JOINED HERE markers are strictly per-viewer: a viewer sees
//    ONLY their own first backing_moment for the nominee, never
//    anyone else's. The viewer always sees their own marker (with 🔒
//    when the moment is currently private — Phase 2 owner-sees-all);
//    logged-out viewers get no marker.
//  - Effective visibility is read at RENDER time:
//      COALESCE(credit_transactions.visibility, users.show_supports)
//    `backing_moments.visibility_at_support` is audit-only and is
//    never consulted here.
//  - Community surfaces render aggregate COUNTS only — no backer
//    names, ever (so private backers can never leak).
//  - seed_community_* accounts are excluded from every user-attributed
//    query.

export interface TimelineEntry {
  type: MilestoneType;
  createdAt: string;
  rankAtEvent: number | null;
  creditsAtEvent: number | null;
  backersAtEvent: number | null;
}

export interface JoinMarker {
  supportedAt: string;
  rankAtSupport: number | null;
  credits: number;
  /** Read-time effective visibility of the viewer's first moment. */
  isPublic: boolean;
}

// The nominee's public milestone trail, earliest → latest. Empty when
// the cron has recorded no events — callers must render nothing then.
export async function getJourneyTimeline(
  rankingId: string,
  profileId: string
): Promise<TimelineEntry[]> {
  const events = await getMilestoneEvents(rankingId, profileId);
  return events.map((e) => ({
    type: e.type,
    createdAt: e.createdAt,
    rankAtEvent: e.rankAtEvent,
    creditsAtEvent: e.creditsAtEvent,
    backersAtEvent: e.backersAtEvent,
  }));
}

// The viewer's OWN first backing moment for this nominee (ORDER BY
// supported_at LIMIT 1 — no new table needed). Null when the viewer
// never backed, is logged out, or is a seed/excluded account.
export async function getViewerJoinMarker(
  viewerId: string | null,
  rankingId: string,
  profileId: string
): Promise<JoinMarker | null> {
  if (!viewerId) return null;
  const row = (await db
    .prepare(
      `SELECT bm.supported_at AS supported_at,
              bm.rank_at_support AS rank_at_support,
              bm.credits AS credits,
              COALESCE(ct.visibility, u.show_supports, 'public') AS eff_vis
       FROM backing_moments bm
       JOIN users u ON u.id = bm.user_id
       LEFT JOIN credit_transactions ct ON ct.payment_id = bm.payment_id
       WHERE bm.user_id = ?
         AND bm.ranking_id = ?
         AND bm.profile_id = ?
         AND ${notSeedClause("u")}
         AND ${activeUserClause("u")}
       ORDER BY bm.supported_at ASC
       LIMIT 1`
    )
    .get(viewerId, rankingId, profileId)) as unknown as
    | {
        supported_at: string;
        rank_at_support: number | null;
        credits: number;
        eff_vis: string;
      }
    | undefined;
  if (!row) return null;
  return {
    supportedAt: row.supported_at,
    rankAtSupport: row.rank_at_support,
    credits: row.credits,
    isPublic: row.eff_vis === "public",
  };
}

export interface RoadEntry {
  profileId: string;
  profileName: string;
  profilePhotoUrl: string | null;
  rank: number;
  totalCredits: number;
  backerCount: number;
  trail: TimelineEntry[];
}

// Road to Top 3: nominees that REACHED the Top 3 (have a reached_3
// event) — currently top-3 or previously. The trail runs from first
// appearance to now. Nominees that never reached Top 3 are excluded —
// no aspirational fabrication. Empty when nobody has reached it.
export async function getRoadToTop3(
  rankingId: string
): Promise<RoadEntry[]> {
  const rows = (await db
    .prepare(
      `SELECT p.id AS profile_id, p.name AS profile_name,
              p.photo_url AS profile_photo_url,
              COALESCE(SUM(ct.credits), 0) AS total_credits,
              COUNT(DISTINCT CASE WHEN ${notSeedClause("u")} AND ${activeUserClause("u")}
                                 THEN ct.supporter_user_id END) AS backer_count
       FROM profiles p
       LEFT JOIN credit_transactions ct
         ON ct.profile_id = p.id AND ct.ranking_id = p.ranking_id
       LEFT JOIN users u ON u.id = ct.supporter_user_id
       WHERE p.ranking_id = ? AND p.deleted_at IS NULL
         AND EXISTS (SELECT 1 FROM milestone_events me
                     WHERE me.ranking_id = p.ranking_id
                       AND me.profile_id = p.id
                       AND me.type = 'reached_3')
       GROUP BY p.id
       ORDER BY total_credits DESC, p.created_at ASC
       LIMIT 3`
    )
    .all(rankingId)) as unknown as {
    profile_id: string;
    profile_name: string;
    profile_photo_url: string | null;
    total_credits: number;
    backer_count: number;
  }[];
  const out: RoadEntry[] = [];
  let rank = 0;
  for (const r of rows) {
    rank += 1;
    out.push({
      profileId: r.profile_id,
      profileName: r.profile_name,
      profilePhotoUrl: r.profile_photo_url,
      rank,
      totalCredits: r.total_credits,
      backerCount: r.backer_count,
      trail: await getJourneyTimeline(rankingId, r.profile_id),
    });
  }
  return out;
}

export interface ChallengerEntry {
  profileId: string;
  profileName: string;
  rank: number;
  totalCredits: number;
  backerCount: number;
  /** Credits behind the current #3. Null when there is no #3. */
  gapToThird: number | null;
}

// Approaching nominees (ranks 4–10 with real credits): current facts
// only — credits, gap to #3, backers — plus the community question.
// No trail (they haven't reached Top 3) and no promises.
export async function getTop3Challengers(
  rankingId: string
): Promise<ChallengerEntry[]> {
  const rows = (await db
    .prepare(
      `SELECT p.id AS profile_id, p.name AS profile_name,
              COALESCE(SUM(ct.credits), 0) AS total_credits,
              COUNT(DISTINCT CASE WHEN ${notSeedClause("u")} AND ${activeUserClause("u")}
                                 THEN ct.supporter_user_id END) AS backer_count,
              p.created_at AS added_at
       FROM profiles p
       LEFT JOIN credit_transactions ct
         ON ct.profile_id = p.id AND ct.ranking_id = p.ranking_id
       LEFT JOIN users u ON u.id = ct.supporter_user_id
       WHERE p.ranking_id = ? AND p.deleted_at IS NULL
       GROUP BY p.id
       ORDER BY total_credits DESC, added_at ASC`
    )
    .all(rankingId)) as unknown as {
    profile_id: string;
    profile_name: string;
    total_credits: number;
    backer_count: number;
  }[];
  const ranked = rows.map((r, i) => ({ ...r, rank: i + 1 }));
  const third = ranked.find((r) => r.rank === 3);
  return ranked
    .filter((r) => r.rank >= 4 && r.rank <= 10 && r.total_credits > 0)
    .map((r) => ({
      profileId: r.profile_id,
      profileName: r.profile_name,
      rank: r.rank,
      totalCredits: r.total_credits,
      backerCount: r.backer_count,
      gapToThird:
        third && third.total_credits > 0
          ? Math.max(0, third.total_credits - r.total_credits)
          : null,
    }));
}

export interface CommunityBackerMilestone {
  profileId: string;
  profileName: string;
  backersAtEvent: number;
  createdAt: string;
}

// Community crowd story: backer-count growth over time, sourced ONLY
// from milestone_events (backers_50 rows across the ranking). Counts
// only — no backer is ever named.
export async function getCommunityStory(rankingId: string): Promise<{
  totalBackers: number;
  milestones: CommunityBackerMilestone[];
}> {
  const totalRow = (await db
    .prepare(
      `SELECT COUNT(DISTINCT CASE WHEN ${notSeedClause("u")} AND ${activeUserClause("u")}
                                 THEN ct.supporter_user_id END) AS total_backers
       FROM credit_transactions ct
       LEFT JOIN users u ON u.id = ct.supporter_user_id
       WHERE ct.ranking_id = ?`
    )
    .get(rankingId)) as unknown as { total_backers: number } | undefined;
  const milestoneRows = (await db
    .prepare(
      `SELECT me.profile_id AS profile_id, p.name AS profile_name,
              me.backers_at_event AS backers_at_event,
              me.created_at AS created_at
       FROM milestone_events me
       JOIN profiles p ON p.id = me.profile_id
       WHERE me.ranking_id = ? AND me.type = 'backers_50'
         AND p.deleted_at IS NULL
       ORDER BY me.created_at ASC`
    )
    .all(rankingId)) as unknown as {
    profile_id: string;
    profile_name: string;
    backers_at_event: number | null;
    created_at: string;
  }[];
  return {
    totalBackers: totalRow?.total_backers ?? 0,
    milestones: milestoneRows.map((r) => ({
      profileId: r.profile_id,
      profileName: r.profile_name,
      backersAtEvent: r.backers_at_event ?? 50,
      createdAt: r.created_at,
    })),
  };
}
