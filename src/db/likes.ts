import { db } from "./client";
import { newId } from "@/lib/id";

// One Like per user per Nominee per Ranking, enforced by the UNIQUE
// constraint on (ranking_id, profile_id, user_id) in the schema.
// createdAt is an optional override used only by the demo seed data.
export async function addLike(params: {
  rankingId: string;
  profileId: string;
  userId: string;
  createdAt?: string;
}): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO likes (id, ranking_id, profile_id, user_id, created_at)
VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')))`
    )
    .run(
      newId(),
      params.rankingId,
      params.profileId,
      params.userId,
      params.createdAt ?? null
    );
  return result.changes > 0;
}

export async function likedProfileIdsForUser(
  rankingId: string,
  userId: string
): Promise<Set<string>> {
  const rows = (await db
    .prepare(
      "SELECT profile_id FROM likes WHERE ranking_id = ? AND user_id = ?"
    )
    .all(rankingId, userId)) as unknown as { profile_id: string }[];
  return new Set(rows.map((r) => r.profile_id));
}

// Batched version of likeCountForUser for an entire Ranking page, one
// query instead of one per Nominee row.
export async function likeCountsForUser(
  rankingId: string,
  userId: string
): Promise<Map<string, number>> {
  const rows = (await db
    .prepare(
      "SELECT profile_id, count FROM likes WHERE ranking_id = ? AND user_id = ?"
    )
    .all(rankingId, userId)) as unknown as { profile_id: string; count: number }[];
  return new Map(rows.map((r) => [r.profile_id, r.count]));
}

// How many times this user has already Liked this Nominee (0 if never).
// Distinct from likedProfileIdsForUser: that only tells you "has liked at
// least once", this tells you the actual count needed to check against
// the Share-based cap in src/lib/actions/likes.ts.
export async function likeCountForUser(
  rankingId: string,
  profileId: string,
  userId: string
): Promise<number> {
  const row = (await db
    .prepare(
      "SELECT count FROM likes WHERE ranking_id = ? AND profile_id = ? AND user_id = ?"
    )
    .get(rankingId, profileId, userId)) as unknown as
    | { count: number }
    | undefined;
  return row?.count ?? 0;
}

// Records one additional Like from this user for this Nominee. Uses the
// same UNIQUE (ranking_id, profile_id, user_id) row as a plain Like always
// has, the first Like inserts count=1, every Like after that (unlocked by
// a Share, see likeAction) increments count on that same row via upsert.
export async function incrementLike(params: {
  rankingId: string;
  profileId: string;
  userId: string;
  createdAt?: string;
}): Promise<void> {
  await db
    .prepare(
      `INSERT INTO likes (id, ranking_id, profile_id, user_id, created_at, count)
VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')), 1)
ON CONFLICT (ranking_id, profile_id, user_id)
DO UPDATE SET count = count + 1`
    )
    .run(
      newId(),
      params.rankingId,
      params.profileId,
      params.userId,
      params.createdAt ?? null
    );
}

export interface LikedItem {
  rankingId: string;
  rankingTitle: string;
  profileId: string;
  profileName: string;
  count: number;
  createdAt: string;
}

// One row per (Ranking, Nominee) this user has ever Liked — powers the
// "Rankings you've liked" section on the user's own Settings page.
// Excludes Likes against a Nominee or Ranking that's since been
// soft-deleted so the list never links to something that 404s.
export async function likedItemsForUser(userId: string): Promise<LikedItem[]> {
  const rows = (await db
    .prepare(
      `SELECT l.ranking_id, r.title AS ranking_title, l.profile_id,
              p.name AS profile_name, l.count, l.created_at
       FROM likes l
       JOIN rankings r ON r.id = l.ranking_id
       JOIN profiles p ON p.id = l.profile_id
       WHERE l.user_id = ? AND r.deleted_at IS NULL AND p.deleted_at IS NULL
       ORDER BY l.created_at DESC`
    )
    .all(userId)) as unknown as {
    ranking_id: string;
    ranking_title: string;
    profile_id: string;
    profile_name: string;
    count: number;
    created_at: string;
  }[];
  return rows.map((r) => ({
    rankingId: r.ranking_id,
    rankingTitle: r.ranking_title,
    profileId: r.profile_id,
    profileName: r.profile_name,
    count: r.count,
    createdAt: r.created_at,
  }));
}
