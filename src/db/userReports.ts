import { db } from "./client";
import { newId } from "@/lib/id";

export type ReportStatus = "pending" | "reviewed";

export interface UserReport {
  id: string;
  reporterUserId: string;
  targetUserId: string;
  reason: string;
  status: ReportStatus;
  createdAt: string;
}

export interface PendingUserReport extends UserReport {
  reporterName: string;
  targetName: string;
  targetHidden: boolean;
}

interface UserReportRow {
  id: string;
  reporter_user_id: string;
  target_user_id: string;
  reason: string;
  status: string;
  created_at: string;
  reporter_name: string | null;
  target_name: string | null;
  target_is_hidden: number | null;
}

function toReport(row: UserReportRow): PendingUserReport {
  return {
    id: row.id,
    reporterUserId: row.reporter_user_id,
    targetUserId: row.target_user_id,
    reason: row.reason,
    status: row.status === "reviewed" ? "reviewed" : "pending",
    createdAt: row.created_at,
    reporterName: row.reporter_name ?? "(deleted account)",
    targetName: row.target_name ?? "(deleted account)",
    targetHidden: !!row.target_is_hidden,
  };
}

// One report per call; the API route enforces the no-self-report rule,
// the 1–500 char reason, and the 10/day reporter cap.
export async function createReport(params: {
  reporterUserId: string;
  targetUserId: string;
  reason: string;
}): Promise<UserReport> {
  const id = newId();
  await db
    .prepare(
      `INSERT INTO user_reports (id, reporter_user_id, target_user_id, reason, status)
       VALUES (?, ?, ?, ?, 'pending')`
    )
    .run(id, params.reporterUserId, params.targetUserId, params.reason);
  const row = (await db
    .prepare("SELECT * FROM user_reports WHERE id = ?")
    .get(id)) as unknown as UserReportRow | undefined;
  const r = row!;
  return {
    id: r.id,
    reporterUserId: r.reporter_user_id,
    targetUserId: r.target_user_id,
    reason: r.reason,
    status: "pending",
    createdAt: r.created_at,
  };
}

// Admin queue: pending reports, oldest first, with display names and the
// target's current hidden state.
export async function listPendingReports(): Promise<PendingUserReport[]> {
  const rows = (await db
    .prepare(
      `SELECT ur.*, ru.name AS reporter_name, tu.name AS target_name,
              tu.is_hidden AS target_is_hidden
       FROM user_reports ur
       LEFT JOIN users ru ON ru.id = ur.reporter_user_id
       LEFT JOIN users tu ON tu.id = ur.target_user_id
       WHERE ur.status = 'pending'
       ORDER BY ur.created_at ASC`
    )
    .all()) as unknown as UserReportRow[];
  return rows.map(toReport);
}

export async function setReportStatus(
  reportId: string,
  status: ReportStatus
): Promise<void> {
  await db
    .prepare("UPDATE user_reports SET status = ? WHERE id = ?")
    .run(status, reportId);
}

// Reports filed by this reporter in the last 24 hours — the API route
// caps at 10/day.
export async function countRecentReportsByReporter(
  reporterUserId: string
): Promise<number> {
  const row = (await db
    .prepare(
      `SELECT COUNT(*) AS n FROM user_reports
       WHERE reporter_user_id = ? AND created_at >= datetime('now', '-1 day')`
    )
    .get(reporterUserId)) as unknown as { n: number } | undefined;
  return row?.n ?? 0;
}

// Idempotent: blocking twice is a no-op (UNIQUE constraint + OR IGNORE).
export async function blockUser(
  blockerUserId: string,
  blockedUserId: string
): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO user_blocks (id, blocker_user_id, blocked_user_id)
       VALUES (?, ?, ?)`
    )
    .run(newId(), blockerUserId, blockedUserId);
}

export async function unblockUser(
  blockerUserId: string,
  blockedUserId: string
): Promise<void> {
  await db
    .prepare(
      `DELETE FROM user_blocks WHERE blocker_user_id = ? AND blocked_user_id = ?`
    )
    .run(blockerUserId, blockedUserId);
}

export async function isBlocked(
  blockerUserId: string,
  blockedUserId: string
): Promise<boolean> {
  const row = (await db
    .prepare(
      `SELECT 1 AS x FROM user_blocks
       WHERE blocker_user_id = ? AND blocked_user_id = ?`
    )
    .get(blockerUserId, blockedUserId)) as unknown as { x: number } | undefined;
  return !!row;
}

// Either direction counts: a block makes both profiles "unavailable" to
// each other, and the page never reveals which direction the block runs.
export async function isBlockedEither(
  userIdA: string,
  userIdB: string
): Promise<boolean> {
  if (userIdA === userIdB) return false;
  const row = (await db
    .prepare(
      `SELECT 1 AS x FROM user_blocks
       WHERE (blocker_user_id = ? AND blocked_user_id = ?)
          OR (blocker_user_id = ? AND blocked_user_id = ?)`
    )
    .get(userIdA, userIdB, userIdB, userIdA)) as unknown as
    | { x: number }
    | undefined;
  return !!row;
}

// Moderation hiding. Hidden users render "This profile is unavailable."
// to everyone and vanish from supporter lists, taste-match sets, and all
// other identity-adjacent surfaces (see activeUserClause). Ranking
// totals are untouched — hiding is about identity, never about numbers.
export async function setUserHidden(
  userId: string,
  hidden: boolean
): Promise<void> {
  await db
    .prepare("UPDATE users SET is_hidden = ? WHERE id = ?")
    .run(hidden ? 1 : 0, userId);
}
