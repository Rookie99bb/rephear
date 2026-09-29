import { db } from "./client";
import { newId } from "@/lib/id";

// Phase 3 (§19): follows — rankings + communities (categories) ONLY.
// User-follows are explicitly out of scope: target_type is allowlisted
// here AND validated again in the API route, so a 'user' follow can
// never be created through any path.

export const FOLLOW_TARGET_TYPES = ["ranking", "category"] as const;
export type FollowTargetType = (typeof FOLLOW_TARGET_TYPES)[number];

export function isFollowTargetType(
  value: unknown
): value is FollowTargetType {
  return (
    value === "ranking" || value === "category"
  );
}

export interface Follow {
  id: string;
  userId: string;
  targetType: FollowTargetType;
  targetId: string;
  createdAt: string;
}

interface FollowRow {
  id: string;
  user_id: string;
  target_type: string;
  target_id: string;
  created_at: string;
}

function toFollow(row: FollowRow): Follow {
  return {
    id: row.id,
    userId: row.user_id,
    targetType: row.target_type as FollowTargetType,
    targetId: row.target_id,
    createdAt: row.created_at,
  };
}

// The follow target must actually exist (FK-style guard — follows has no
// DB-level foreign key since targets span two tables).
async function targetExists(
  targetType: FollowTargetType,
  targetId: string
): Promise<boolean> {
  const table = targetType === "ranking" ? "rankings" : "categories";
  const row = (await db
    .prepare(`SELECT id FROM ${table} WHERE id = ?`)
    .get(targetId)) as unknown as { id: string } | undefined;
  return !!row;
}

export async function follow(
  userId: string,
  targetType: FollowTargetType,
  targetId: string
): Promise<{ followed: boolean; follow: Follow | null }> {
  if (!(await targetExists(targetType, targetId))) {
    return { followed: false, follow: null };
  }
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO follows (id, user_id, target_type, target_id)
       VALUES (?, ?, ?, ?)`
    )
    .run(newId(), userId, targetType, targetId);
  const row = (await db
    .prepare(
      `SELECT * FROM follows
       WHERE user_id = ? AND target_type = ? AND target_id = ?`
    )
    .get(userId, targetType, targetId)) as unknown as FollowRow | undefined;
  return { followed: result.changes > 0, follow: row ? toFollow(row) : null };
}

export async function unfollow(
  userId: string,
  targetType: FollowTargetType,
  targetId: string
): Promise<boolean> {
  const result = await db
    .prepare(
      `DELETE FROM follows
       WHERE user_id = ? AND target_type = ? AND target_id = ?`
    )
    .run(userId, targetType, targetId);
  return result.changes > 0;
}

export async function isFollowing(
  userId: string,
  targetType: FollowTargetType,
  targetId: string
): Promise<boolean> {
  const row = (await db
    .prepare(
      `SELECT id FROM follows
       WHERE user_id = ? AND target_type = ? AND target_id = ?`
    )
    .get(userId, targetType, targetId)) as unknown as { id: string } | undefined;
  return !!row;
}

export async function listFollows(userId: string): Promise<Follow[]> {
  const rows = (await db
    .prepare(
      `SELECT * FROM follows WHERE user_id = ? ORDER BY created_at DESC`
    )
    .all(userId)) as unknown as FollowRow[];
  return rows.map(toFollow);
}

// Follower user ids for a target — used by the milestone cron to send
// follow_update notifications. Seed accounts and hidden users excluded
// (they never opted into anything real).
export async function listFollowerUserIds(
  targetType: FollowTargetType,
  targetId: string
): Promise<string[]> {
  const rows = (await db
    .prepare(
      `SELECT f.user_id AS user_id
       FROM follows f
       JOIN users u ON u.id = f.user_id
       WHERE f.target_type = ? AND f.target_id = ?
         AND u.id NOT LIKE 'seed\\_community\\_%' ESCAPE '\\'
         AND u.is_hidden = 0`
    )
    .all(targetType, targetId)) as unknown as { user_id: string }[];
  return rows.map((r) => r.user_id);
}

export async function countFollowers(
  targetType: FollowTargetType,
  targetId: string
): Promise<number> {
  const row = (await db
    .prepare(
      `SELECT COUNT(*) AS n FROM follows
       WHERE target_type = ? AND target_id = ?`
    )
    .get(targetType, targetId)) as unknown as { n: number } | undefined;
  return row?.n ?? 0;
}
