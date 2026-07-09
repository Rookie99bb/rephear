import { db } from "./client";
import { newId } from "@/lib/id";
import { colorForName } from "@/lib/avatar";
import type { Profile, Ranking } from "@/lib/types";

export interface ProfileRow {
  id: string;
  name: string;
  bio: string;
  avatar_color: string;
  claim_status: string;
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string;
  region: string;
  interests: string;
}

export function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    name: row.name,
    bio: row.bio,
    avatarColor: row.avatar_color,
    claimStatus: row.claim_status as Profile["claimStatus"],
    claimedBy: row.claimed_by,
    claimedAt: row.claimed_at,
    createdAt: row.created_at,
    region: row.region,
    interests: row.interests
      ? row.interests.split(",").map((s) => s.trim()).filter(Boolean)
      : [],
  };
}

// createdAt is an optional override used only by the demo seed data, so
// activity has a believable history instead of everything being
// timestamped "now". Real user-created profiles never pass it.
export function createProfile(params: {
  name: string;
  bio?: string;
  region?: string;
  interests?: string[];
  createdAt?: string;
}): Profile {
  const id = newId();
  const name = params.name.trim();
  const interests = (params.interests ?? []).join(", ");
  db.prepare(
    `INSERT INTO profiles (id, name, bio, avatar_color, region, interests, created_at)
     VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`
  ).run(
    id,
    name,
    (params.bio ?? "").trim(),
    colorForName(name),
    (params.region ?? "").trim(),
    interests,
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

// Case-insensitive partial name match, used when adding a Nominee so
// existing Public Profiles are reused instead of duplicated.
export function searchProfilesByName(query: string, limit = 8): Profile[] {
  const rows = db
    .prepare(
      `SELECT * FROM profiles WHERE name LIKE ? COLLATE NOCASE ORDER BY name LIMIT ?`
    )
    .all(`%${query.trim()}%`, limit) as unknown as ProfileRow[];
  return rows.map(toProfile);
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

export function listRankingsForProfile(profileId: string): Ranking[] {
  const rows = db
    .prepare(
      `SELECT r.* FROM rankings r
       JOIN ranking_profiles rp ON rp.ranking_id = r.id
       WHERE rp.profile_id = ? AND r.is_hidden = 0 AND r.deleted_at IS NULL
         AND rp.deleted_at IS NULL
       ORDER BY rp.created_at DESC`
    )
    .all(profileId) as unknown as {
    id: string;
    title: string;
    country: string;
    city: string;
    description: string;
    created_by: string;
    created_at: string;
    is_hidden: number;
    deleted_at: string | null;
  }[];
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    country: row.country,
    city: row.city,
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at,
    isHidden: !!row.is_hidden,
    deletedAt: row.deleted_at,
  }));
}
