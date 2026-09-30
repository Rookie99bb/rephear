import { db } from "./client";
import { newId } from "@/lib/id";

// Phase 3 (§16): in-app notification center. Delivery is IN-APP ONLY —
// email/push are explicitly later and need their own opt-in (never
// piggyback digest email consent).
//
// Conservative defaults: milestones only. Copy reinforces judgement /
// discovery / belonging / history — NEVER "Support again" pressure copy.
//
// Per-user rate cap: max NOTIFICATIONS_PER_DAY rows per user per day
// (product call default: 5, batched digest-style). Over-cap events are
// dropped with a log line — a missed milestone ping is better than a
// spammy inbox.

export const NOTIFICATIONS_PER_DAY = 5;

export const NOTIFICATION_TYPES = [
  "early_backer_milestone",
  "backed_nominee_milestone",
  "ranking_milestone",
  "follow_update",
  "nominee_milestone",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type as NotificationType,
    title: row.title,
    body: row.body,
    link: row.link,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export async function getNotifyMilestonesPref(
  userId: string
): Promise<boolean> {
  const row = (await db
    .prepare(`SELECT notify_milestones FROM users WHERE id = ?`)
    .get(userId)) as unknown as { notify_milestones: number | null } | undefined;
  // Column defaults to 1; treat missing/NULL as on (conservative default:
  // milestones only).
  return (row?.notify_milestones ?? 1) === 1;
}

export async function setNotifyMilestonesPref(
  userId: string,
  on: boolean
): Promise<void> {
  await db
    .prepare(`UPDATE users SET notify_milestones = ? WHERE id = ?`)
    .run(on ? 1 : 0, userId);
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function countNotificationsToday(
  userId: string
): Promise<number> {
  const row = (await db
    .prepare(
      `SELECT COUNT(*) AS n FROM notifications
       WHERE user_id = ? AND substr(created_at, 1, 10) = ?`
    )
    .get(userId, todayUTC())) as unknown as { n: number } | undefined;
  return row?.n ?? 0;
}

// Creates an in-app notification. Returns { created: false } (with a
// reason) when the user's milestone pref is off or the daily rate cap
// is hit — the caller must NOT retry or escalate to another channel.
export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
}): Promise<{ created: boolean; reason?: string; notification?: Notification }> {
  if (!(await getNotifyMilestonesPref(params.userId))) {
    return { created: false, reason: "pref_off" };
  }
  if ((await countNotificationsToday(params.userId)) >= NOTIFICATIONS_PER_DAY) {
    console.info(
      `[notifications] rate cap hit for user ${params.userId}; dropping ${params.type}`
    );
    return { created: false, reason: "rate_capped" };
  }
  const id = newId();
  await db
    .prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, link)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      params.userId,
      params.type,
      params.title,
      params.body,
      params.link ?? null
    );
  const row = (await db
    .prepare(`SELECT * FROM notifications WHERE id = ?`)
    .get(id)) as unknown as NotificationRow;
  return { created: true, notification: toNotification(row) };
}

export async function listNotifications(
  userId: string,
  limit = 30
): Promise<Notification[]> {
  const rows = (await db
    .prepare(
      `SELECT * FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(userId, limit)) as unknown as NotificationRow[];
  return rows.map(toNotification);
}

export async function countUnreadNotifications(
  userId: string
): Promise<number> {
  const row = (await db
    .prepare(
      `SELECT COUNT(*) AS n FROM notifications
       WHERE user_id = ? AND read_at IS NULL`
    )
    .get(userId)) as unknown as { n: number } | undefined;
  return row?.n ?? 0;
}

export async function markNotificationRead(
  userId: string,
  notificationId: string
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE notifications
       SET read_at = datetime('now')
       WHERE id = ? AND user_id = ? AND read_at IS NULL`
    )
    .run(notificationId, userId);
  return result.changes > 0;
}

export async function markAllNotificationsRead(
  userId: string
): Promise<number> {
  const result = await db
    .prepare(
      `UPDATE notifications
       SET read_at = datetime('now')
       WHERE user_id = ? AND read_at IS NULL`
    )
    .run(userId);
  return result.changes;
}
