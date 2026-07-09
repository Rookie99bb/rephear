import { db } from "./client";
import { newId } from "@/lib/id";
import type { Profile, NomineeAdminView } from "@/lib/types";
import { toProfile, type ProfileRow } from "./profiles";

// Adds a Profile as a Nominee to a Ranking. A Profile can only appear once
// per Ranking (UNIQUE(ranking_id, profile_id)). If that pairing already
// exists but was previously soft-deleted, this UPSERTs it back to active
// (clears deleted_at) instead of silently no-op'ing — otherwise "Add
// Nominee" would appear to succeed while the nominee stayed hidden.
// createdAt is an optional override used only by the demo seed data (it
// controls when a Nominee is shown as having "joined" a Ranking).
export function addNomineeToRanking(params: {
  rankingId: string;
  profileId: string;
  addedBy: string;
  createdAt?: string;
}): void {
  db.prepare(
    `INSERT INTO ranking_profiles (id, ranking_id, profile_id, added_by, created_at)
     VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')))
     ON CONFLICT (ranking_id, profile_id) DO UPDATE SET deleted_at = NULL`
  ).run(
    newId(),
    params.rankingId,
    params.profileId,
    params.addedBy,
    params.createdAt ?? null
  );
}

// Public-facing: only active (not soft-deleted) Nominees.
export function listNomineesForRanking(rankingId: string): Profile[] {
  const rows = db
    .prepare(
      `SELECT p.* FROM profiles p
       JOIN ranking_profiles rp ON rp.profile_id = p.id
       WHERE rp.ranking_id = ? AND rp.deleted_at IS NULL
       ORDER BY rp.created_at ASC`
    )
    .all(rankingId) as unknown as ProfileRow[];
  return rows.map(toProfile);
}

// Admin moderation view: includes soft-deleted Nominees too, along with
// their deleted_at, so an admin can find and restore them.
export function listNomineesForRankingAdmin(
  rankingId: string
): NomineeAdminView[] {
  const rows = db
    .prepare(
      `SELECT p.*, rp.deleted_at AS rp_deleted_at FROM profiles p
       JOIN ranking_profiles rp ON rp.profile_id = p.id
       WHERE rp.ranking_id = ?
       ORDER BY rp.created_at ASC`
    )
    .all(rankingId) as unknown as (ProfileRow & { rp_deleted_at: string | null })[];
  return rows.map((row) => ({
    profile: toProfile(row),
    deletedAt: row.rp_deleted_at,
  }));
}

// Admin moderation: soft-deletes a Nominee's participation in one specific
// Ranking. The underlying Public Profile is left completely untouched (it
// may still appear in other Rankings), and — critically — Likes, Payments,
// and Credit Transactions recorded for this Ranking+Profile pairing are
// NEVER touched. They simply stop being joined into the public leaderboard
// query (which filters on deleted_at IS NULL) and reappear automatically
// the moment the Nominee is restored.
export function softDeleteNominee(rankingId: string, profileId: string): void {
  db.prepare(
    `UPDATE ranking_profiles SET deleted_at = datetime('now')
     WHERE ranking_id = ? AND profile_id = ? AND deleted_at IS NULL`
  ).run(rankingId, profileId);
}

export function restoreNominee(rankingId: string, profileId: string): void {
  db.prepare(
    "UPDATE ranking_profiles SET deleted_at = NULL WHERE ranking_id = ? AND profile_id = ?"
  ).run(rankingId, profileId);
}
