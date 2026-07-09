import { db } from "./client";
import { newId } from "@/lib/id";

// One Like per user per Nominee per Ranking — enforced by the UNIQUE
// constraint on (ranking_id, profile_id, user_id) in the schema.
// createdAt is an optional override used only by the demo seed data.
export function addLike(params: {
  rankingId: string;
  profileId: string;
  userId: string;
  createdAt?: string;
}): boolean {
  const result = db
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

export function likedProfileIdsForUser(
  rankingId: string,
  userId: string
): Set<string> {
  const rows = db
    .prepare(
      "SELECT profile_id FROM likes WHERE ranking_id = ? AND user_id = ?"
    )
    .all(rankingId, userId) as unknown as { profile_id: string }[];
  return new Set(rows.map((r) => r.profile_id));
}
