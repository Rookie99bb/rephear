import { db } from "./client";
import { newId } from "@/lib/id";
import type { AuditLog } from "@/lib/types";

interface AuditLogRow {
  id: string;
  actor_user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  details: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

function toAuditLog(row: AuditLogRow): AuditLog {
  let details: Record<string, unknown> = {};
  try {
    details = JSON.parse(row.details);
  } catch {
    details = {};
  }
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    details,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  };
}

// The full list of action strings currently recorded. This is documentation,
// not an enum enforced by the schema — `action` is a plain TEXT column so
// new action types can be added later without any migration.
export const AUDIT_ACTIONS = {
  CLAIM_REQUEST_SUBMITTED: "claim_request_submitted",
  CLAIM_APPROVED: "claim_approved",
  CLAIM_REJECTED: "claim_rejected",
  RANKING_SOFT_DELETED: "ranking_soft_deleted",
  RANKING_RESTORED: "ranking_restored",
  NOMINEE_SOFT_DELETED: "nominee_soft_deleted",
  NOMINEE_RESTORED: "nominee_restored",
  SPAM_HIDDEN: "spam_hidden",
  SPAM_RESTORED: "spam_restored",
} as const;

// Audit Logs are append-only: this module intentionally exposes no
// update/delete function. Even if one were added by mistake, the
// audit_logs_no_update / audit_logs_no_delete triggers in schema.ts make
// the database itself reject it.
export function recordAuditLog(params: {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}): void {
  db.prepare(
    `INSERT INTO audit_logs
      (id, actor_user_id, action, target_type, target_id, details, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    newId(),
    params.actorUserId,
    params.action,
    params.targetType,
    params.targetId,
    JSON.stringify(params.details ?? {}),
    params.ipAddress ?? null,
    params.userAgent ?? null
  );
}

export interface AuditLogFilters {
  action?: string;
  actorUserId?: string;
  date?: string; // YYYY-MM-DD, matches created_at's date portion
  search?: string; // matches target_id or details substring
  limit?: number;
}

export function listAuditLogs(filters: AuditLogFilters = {}): AuditLog[] {
  const clauses: string[] = [];
  const values: (string | number)[] = [];

  if (filters.action) {
    clauses.push("action = ?");
    values.push(filters.action);
  }
  if (filters.actorUserId) {
    clauses.push("actor_user_id = ?");
    values.push(filters.actorUserId);
  }
  if (filters.date) {
    clauses.push("date(created_at) = date(?)");
    values.push(filters.date);
  }
  if (filters.search) {
    clauses.push("(target_id LIKE ? OR details LIKE ?)");
    const like = `%${filters.search}%`;
    values.push(like, like);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = filters.limit ?? 200;

  const rows = db
    .prepare(
      `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ?`
    )
    .all(...values, limit) as unknown as AuditLogRow[];
  return rows.map(toAuditLog);
}

// Distinct action values seen so far — powers the admin filter dropdown
// without hardcoding a list that could drift from what's actually logged.
export function listDistinctAuditActions(): string[] {
  const rows = db
    .prepare("SELECT DISTINCT action FROM audit_logs ORDER BY action ASC")
    .all() as unknown as { action: string }[];
  return rows.map((r) => r.action);
}
