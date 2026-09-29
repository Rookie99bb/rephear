import { db } from "./client";
import { findUserById } from "./users";
import {
  pubClause,
  notSeedClause,
  activeUserClause,
} from "./visibility";
import { isBlockedEither } from "./userReports";
import { getMostSupported } from "./leaderboards";

// Phase 2 (public identity): read models for /u/[id]. Every function
// here takes an explicit visibility posture — `includePrivate` (owner
// viewing their own profile) or effective-public-only (anyone else).
// Private rows are excluded from the JOIN, never merely hidden in UI
// (invariant 3). backing_moments is NOT read here: D2's base is
// conviction_records (first-back index); Phase 5.3 will enrich with
// moments through this module's interface (integration plan §1 row 13).

export interface InterestTag {
  id: string;
  name: string;
  slug: string;
}

// Distinct categories of the user's activity (likes ∪ conviction
// records → rankings → categories), max 6. Public-only unless the owner
// is looking at their own profile.
export async function getInterestTags(
  userId: string,
  includePrivate: boolean
): Promise<InterestTag[]> {
  const likeVis = includePrivate ? "1=1" : pubClause("l", "u", "likes");
  const backingVis = includePrivate
    ? "1=1"
    : `COALESCE(pay.visibility_choice, u.show_supports, 'public') = 'public'`;
  const rows = (await db
    .prepare(
      `SELECT DISTINCT c.id AS id, c.name AS name, c.slug AS slug
       FROM categories c
       WHERE c.id IN (
         SELECT r.category_id
         FROM likes l
         JOIN users u ON u.id = l.user_id
         JOIN rankings r ON r.id = l.ranking_id
         WHERE l.user_id = ? AND ${likeVis}
           AND ${notSeedClause("u")} AND ${activeUserClause("u")}
           AND r.category_id IS NOT NULL AND r.deleted_at IS NULL
         UNION
         SELECT r.category_id
         FROM conviction_records cr
         JOIN users u ON u.id = cr.user_id
         JOIN payments pay ON pay.id = cr.first_payment_id
         JOIN rankings r ON r.id = cr.ranking_id
         WHERE cr.user_id = ? AND ${backingVis}
           AND ${notSeedClause("u")} AND ${activeUserClause("u")}
           AND r.category_id IS NOT NULL AND r.deleted_at IS NULL
       )
       ORDER BY c.name ASC
       LIMIT 6`
    )
    .all(userId, userId)) as unknown as InterestTag[];
  return rows;
}

export interface PeopleIBackRow {
  rankingId: string;
  rankingTitle: string;
  profileId: string;
  profileName: string;
  profilePhotoUrl: string | null;
  rankAtFirstSupport: number | null;
  currentRank: number | null;
  // rankAtFirstSupport - currentRank; positive = rose since backing.
  // Null unless both ranks are known (never fabricated).
  movement: number | null;
  // Effective visibility of the FIRST support (first-wins). The owner
  // sees rows regardless; anyone else only sees isPublic rows.
  isPublic: boolean;
  lastSupportedAt: string;
}

interface PeopleIBackDbRow {
  ranking_id: string;
  ranking_title: string;
  profile_id: string;
  profile_name: string;
  profile_photo_url: string | null;
  rank_at_first_support: number | null;
  eff_vis: string;
  first_supported_at: string;
  last_supported_at: string | null;
}

// Internal: all rows for the target, visibility-resolved per row.
// Exported getPeopleIBack applies the viewer gate on top.
async function getPeopleIBackRows(
  targetUserId: string
): Promise<PeopleIBackDbRow[]> {
  const rows = (await db
    .prepare(
      `SELECT cr.ranking_id, r.title AS ranking_title, cr.profile_id,
              p.name AS profile_name, p.photo_url AS profile_photo_url,
              cr.rank_at_first_support,
              COALESCE(pay.visibility_choice, u.show_supports, 'public') AS eff_vis,
              cr.first_supported_at,
              cr.last_supported_at
       FROM conviction_records cr
       JOIN users u ON u.id = cr.user_id
       JOIN payments pay ON pay.id = cr.first_payment_id
       JOIN rankings r ON r.id = cr.ranking_id
       JOIN profiles p ON p.id = cr.profile_id
       WHERE cr.user_id = ? AND r.deleted_at IS NULL AND p.deleted_at IS NULL
       ORDER BY COALESCE(cr.last_supported_at, cr.first_supported_at) DESC`
    )
    .all(targetUserId)) as unknown as PeopleIBackDbRow[];
  return rows;
}

// People I Back base (D2): backed-at rank → current rank + movement.
// One getMostSupported per distinct ranking per request (fine at profile
// scale; TODO: cache if profiles ever get heavy).
export async function getPeopleIBack(
  viewerId: string | null,
  targetUserId: string
): Promise<PeopleIBackRow[]> {
  const rows = await getPeopleIBackRows(targetUserId);
  const isOwner = viewerId !== null && viewerId === targetUserId;
  const visible = rows.filter((r) => isOwner || r.eff_vis === "public");

  const rankingIds = [...new Set(visible.map((r) => r.ranking_id))];
  const rankByRanking = new Map<string, Map<string, number>>();
  for (const rankingId of rankingIds) {
    const board = await getMostSupported(rankingId);
    const m = new Map<string, number>();
    board.forEach((entry, idx) => m.set(entry.profile.id, idx + 1));
    rankByRanking.set(rankingId, m);
  }

  return visible.map((r) => {
    const currentRank =
      rankByRanking.get(r.ranking_id)?.get(r.profile_id) ?? null;
    const movement =
      r.rank_at_first_support != null && currentRank != null
        ? r.rank_at_first_support - currentRank
        : null;
    return {
      rankingId: r.ranking_id,
      rankingTitle: r.ranking_title,
      profileId: r.profile_id,
      profileName: r.profile_name,
      profilePhotoUrl: r.profile_photo_url,
      rankAtFirstSupport: r.rank_at_first_support,
      currentRank,
      movement,
      isPublic: r.eff_vis === "public",
      lastSupportedAt: r.last_supported_at ?? r.first_supported_at,
    };
  });
}

export interface IdentityStats {
  // Distinct nominees backed (conviction records).
  backedCreators: number;
  // Backed when outside the Top 10 (rank_at_first_support > 10) and the
  // nominee is now Top 10 — judgement, not spend (invariant 7).
  earlyBacker: number;
  // Same set as earlyBacker; Phase 3's milestone cron will differentiate
  // these two (brief D1).
  reachedTop10: number;
}

export async function getIdentityStats(
  userId: string,
  includePrivate: boolean
): Promise<IdentityStats> {
  const rows = await getPeopleIBack(userId, userId); // owner view = all
  const filtered = includePrivate ? rows : rows.filter((r) => r.isPublic);
  const early = filtered.filter(
    (r) =>
      r.rankAtFirstSupport != null &&
      r.rankAtFirstSupport > 10 &&
      r.currentRank != null &&
      r.currentRank <= 10
  );
  return {
    backedCreators: filtered.length,
    earlyBacker: early.length,
    reachedTop10: early.length,
  };
}

// True when the user has at least one effective-public action (like or
// backing). Drives the "This user keeps their activity private." branch
// for fully-private profiles — no counts derived from private actions.
export async function hasPublicActivity(userId: string): Promise<boolean> {
  const likeRow = (await db
    .prepare(
      `SELECT 1 AS x FROM likes l
       JOIN users u ON u.id = l.user_id
       WHERE l.user_id = ? AND ${pubClause("l", "u", "likes")}
         AND ${notSeedClause("u")} AND ${activeUserClause("u")}
       LIMIT 1`
    )
    .get(userId)) as unknown as { x: number } | undefined;
  if (likeRow) return true;
  const backingRow = (await db
    .prepare(
      `SELECT 1 AS x FROM conviction_records cr
       JOIN users u ON u.id = cr.user_id
       JOIN payments pay ON pay.id = cr.first_payment_id
       WHERE cr.user_id = ?
         AND COALESCE(pay.visibility_choice, u.show_supports, 'public') = 'public'
         AND ${notSeedClause("u")} AND ${activeUserClause("u")}
       LIMIT 1`
    )
    .get(userId)) as unknown as { x: number } | undefined;
  return !!backingRow;
}

// ── Taste Match v1 (D4) ─────────────────────────────────────────────
// Server-side only: there is deliberately NO API route exposing this
// (an endpoint would be a probing oracle). Sets are public-only and
// computed BEFORE any gating, so private activity can never influence
// a score anyone else sees (invariant 3).

export interface TasteMatchResult {
  sharedCount: number;
  scorePct: number;
  // Each shared nominee is a public action for BOTH users, so showing
  // names+photos leaks nothing.
  sharedNominees: { profileId: string; name: string; photoUrl: string | null }[];
}

// Effective-public profile ids from likes ∪ conviction records.
async function publicActionProfileIds(userId: string): Promise<Set<string>> {
  const likeRows = (await db
    .prepare(
      `SELECT DISTINCT l.profile_id AS pid
       FROM likes l
       JOIN users u ON u.id = l.user_id
       WHERE l.user_id = ? AND ${pubClause("l", "u", "likes")}
         AND ${notSeedClause("u")} AND ${activeUserClause("u")}
         AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = l.profile_id AND p.deleted_at IS NULL)`
    )
    .all(userId)) as unknown as { pid: string }[];
  const backingRows = (await db
    .prepare(
      `SELECT DISTINCT cr.profile_id AS pid
       FROM conviction_records cr
       JOIN users u ON u.id = cr.user_id
       JOIN payments pay ON pay.id = cr.first_payment_id
       WHERE cr.user_id = ?
         AND COALESCE(pay.visibility_choice, u.show_supports, 'public') = 'public'
         AND ${notSeedClause("u")} AND ${activeUserClause("u")}
         AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = cr.profile_id AND p.deleted_at IS NULL)`
    )
    .all(userId)) as unknown as { pid: string }[];
  return new Set([
    ...likeRows.map((r) => r.pid),
    ...backingRows.map((r) => r.pid),
  ]);
}

export async function getTasteMatch(
  viewerId: string,
  targetUserId: string
): Promise<TasteMatchResult | null> {
  if (viewerId === targetUserId) return null;
  const [viewer, target] = await Promise.all([
    findUserById(viewerId),
    findUserById(targetUserId),
  ]);
  if (!viewer || !target) return null;
  // Hidden users are purged from taste-match sets on both sides.
  if (viewer.isHidden || target.isHidden) return null;
  // Blocked either direction: no panel, no score (never reveal direction).
  if (await isBlockedEither(viewerId, targetUserId)) return null;
  // Seed accounts never appear as matches (invariant 4).
  if (
    viewer.id.startsWith("seed_community_") ||
    target.id.startsWith("seed_community_")
  )
    return null;

  const [viewerSet, targetSet] = await Promise.all([
    publicActionProfileIds(viewerId),
    publicActionProfileIds(targetUserId),
  ]);
  // K-anonymity floor: both sides need ≥3 public actions, and ≥3 shared,
  // before any score renders — a single shared action must never be
  // reverse-engineerable.
  if (viewerSet.size < 3 || targetSet.size < 3) return null;
  const shared = [...viewerSet].filter((pid) => targetSet.has(pid));
  if (shared.length < 3) return null;

  const scorePct = Math.round(
    (shared.length / Math.min(viewerSet.size, targetSet.size)) * 100
  );

  const placeholders = shared.slice(0, 6).map(() => "?").join(",");
  const nomineeRows = (
    placeholders
      ? ((await db
          .prepare(
            `SELECT id, name, photo_url FROM profiles WHERE id IN (${placeholders})`
          )
          .all(...shared.slice(0, 6))) as unknown as {
          id: string;
          name: string;
          photo_url: string | null;
        }[])
      : []
  );
  const byId = new Map(nomineeRows.map((r) => [r.id, r]));
  const sharedNominees = shared
    .slice(0, 6)
    .map((pid) => {
      const r = byId.get(pid);
      return r
        ? { profileId: r.id, name: r.name, photoUrl: r.photo_url }
        : null;
    })
    .filter((x): x is { profileId: string; name: string; photoUrl: string | null } => x !== null);

  return { sharedCount: shared.length, scorePct, sharedNominees };
}
