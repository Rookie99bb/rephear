import { db } from "./client";
import { newId } from "@/lib/id";
import { colorForName } from "@/lib/avatar";
import type { Profile, Ranking } from "@/lib/types";
import { findRankingById } from "./rankings";

export interface ProfileRow {
  id: string;
  ranking_id: string;
  name: string;
  bio: string;
  photo_url: string;
  avatar_color: string;
  claim_status: string;
  claimed_by: string | null;
  claimed_at: string | null;
  added_by: string;
  created_at: string;
  region: string;
  interests: string;
  deleted_at: string | null;
}

export function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    rankingId: row.ranking_id,
    name: row.name,
    bio: row.bio,
    photoUrl: row.photo_url,
    avatarColor: row.avatar_color,
    claimStatus: row.claim_status as Profile["claimStatus"],
    claimedBy: row.claimed_by,
    claimedAt: row.claimed_at,
    addedBy: row.added_by,
    createdAt: row.created_at,
    region: row.region,
    interests: row.interests
      ? row.interests.split(",").map((s) => s.trim()).filter(Boolean)
      : [],
    deletedAt: row.deleted_at,
  };
}

// A Nominee belongs to exactly one Ranking — there is no shared/reusable
// profile system. Duplicate names within the same Ranking are rejected by
// the caller (see findNomineeByRankingAndName) before this is invoked;
// the UNIQUE(ranking_id, name) index backstops that under a race.
// createdAt is an optional override used only by the demo seed data.
export function createProfile(params: {
  rankingId: string;
  name: string;
  bio?: string;
  photoUrl?: string;
  region?: string;
  interests?: string[];
  addedBy: string;
  createdAt?: string;
}): Profile {
  const id = newId();
  const name = params.name.trim();
  const interests = (params.interests ?? []).join(", ");
  db.prepare(
    `INSERT INTO profiles
      (id, ranking_id, name, bio, photo_url, avatar_color, region, interests, added_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`
  ).run(
    id,
    params.rankingId,
    name,
    (params.bio ?? "").trim(),
    (params.photoUrl ?? "").trim(),
    colorForName(name),
    (params.region ?? "").trim(),
    interests,
    params.addedBy,
    params.createdAt ?? null
  );
  return findProfileById(id)!;
}

export function findProfileById(id: string): Profile | null {
  const row = db
    .prepare("SELECT * FROM profiles WHERE id = ?")
    .get(id) as unknown as ProfileRow | undefined;
  return row ? toProfile(row) : null;
}

// Case-insensitive exact-name match within one Ranking. Used to enforce
// "one profile = one entry per Ranking" before creating a new Nominee —
// this is NOT a cross-Ranking profile search/reuse feature.
export function findNomineeByRankingAndName(
  rankingId: string,
  name: string
): Profile | null {
  const row = db
    .prepare(
      "SELECT * FROM profiles WHERE ranking_id = ? AND name = ? COLLATE NOCASE AND deleted_at IS NULL"
    )
    .get(rankingId, name.trim()) as unknown as ProfileRow | undefined;
  return row ? toProfile(row) : null;
}

export function claimProfile(
  profileId: string,
  userId: string,
  claimedAt?: string
): Profile {
  db.prepare(
    `UPDATE profiles
     SET claim_status = 'claimed', claimed_by = ?, claimed_at = COALESCE(?, datetime('now'))
     WHERE id = ?`
  ).run(userId, claimedAt ?? null, profileId);
  return findProfileById(profileId)!;
}

export interface ProfileStats {
  totalLikes: number;
  totalReputationCredits: number;
}

export function getProfileStats(profileId: string): ProfileStats {
  const likeRow = db
    .prepare("SELECT COUNT(*) AS c FROM likes WHERE profile_id = ?")
    .get(profileId) as unknown as { c: number };
  const creditRow = db
    .prepare(
      "SELECT COALESCE(SUM(credits), 0) AS c FROM credit_transactions WHERE profile_id = ?"
    )
    .get(profileId) as unknown as { c: number };
  return {
    totalLikes: likeRow.c,
    totalReputationCredits: creditRow.c,
  };
}

// A Nominee belongs to exactly one Ranking, so this is always 0 or 1
// Ranking — kept as an array for compatibility with the Public Profile
// page, which used to show multiple.
export function listRankingsForProfile(profileId: string): Ranking[] {
  const profile = findProfileById(profileId);
  if (!profile) return [];
  const ranking = findRankingById(profile.rankingId);
  if (!ranking || ranking.isHidden || ranking.deletedAt) return [];
  return [ranking];
}

// Public-facing: only active (not soft-deleted) Nominees for one Ranking.
export function listNomineesForRanking(rankingId: string): Profile[] {
  const rows = db
    .prepare(
      "SELECT * FROM profiles WHERE ranking_id = ? AND deleted_at IS NULL ORDER BY created_at ASC"
    )
    .all(rankingId) as unknown as ProfileRow[];
  return rows.map(toProfile);
}

// Admin moderation view: includes soft-deleted Nominees too (deletedAt is
// already part of Profile), so an admin can find and restore them.
export function listNomineesForRankingAdmin(rankingId: string): Profile[] {
  const rows = db
    .prepare("SELECT * FROM profiles WHERE ranking_id = ? ORDER BY created_at ASC")
    .all(rankingId) as unknown as ProfileRow[];
  return rows.map(toProfile);
}

// Soft delete only. The underlying row (and every Like/Payment/Credit
// Transaction tied to it) is never removed — it simply stops being
// joined into public reads and reappears automatically on restore.
export function softDeleteNominee(profileId: string): void {
  db.prepare(
    "UPDATE profiles SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL"
  ).run(profileId);
}

export function restoreNominee(profileId: string): void {
  db.prepare("UPDATE profiles SET deleted_at = NULL WHERE id = ?").run(profileId);
}
