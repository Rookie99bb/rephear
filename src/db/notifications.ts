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
  "nominee_thanks",
  "identity_earned",
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

// Batched pref lookup for the milestone cron's Top-10 approach
// pre-filter (the once-ever notice must not be consumed when the
// owner's pref is off). Same default-on semantics as
// getNotifyMilestonesPref. Missing users count as on.
export async function getNotifyMilestonesPrefs(
  userIds: string[]
): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  const unique = [...new Set(userIds)];
  for (let i = 0; i < unique.length; i += 900) {
    const chunk = unique.slice(i, i + 900);
    const placeholders = chunk.map(() => "?").join(",");
    const rows = (await db
      .prepare(
        `SELECT id, notify_milestones FROM users WHERE id IN (${placeholders})`
      )
      .all(...chunk)) as unknown as {
      id: string;
      notify_milestones: number | null;
    }[];
    for (const r of rows) out.set(r.id, (r.notify_milestones ?? 1) === 1);
  }
  return out;
}

// ── Batched cron writer ─────────────────────────────────────────────
// Same semantics as createNotification (pref gate, then the per-user
// daily rate cap, evaluated in item order so the drop decisions match
// sequential processing exactly), but: 2 preflight reads for the whole
// batch + chunked multi-row INSERTs, instead of 4 statements per
// notification. The milestone cron collects a ranking's notifications
// and flushes them here once.
//
// Returns the total created plus a parallel boolean array (in input
// order) so callers that need per-item granularity (e.g. the Top-10
// approach once-ever notice) can tell which items landed.
export interface NotificationBatchItem {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
}

export async function createNotificationsBatch(
  items: NotificationBatchItem[]
): Promise<{ created: number; createdFlags: boolean[] }> {
  const createdFlags = items.map(() => false);
  if (items.length === 0) return { created: 0, createdFlags };

  const userIds = [...new Set(items.map((i) => i.userId))];
  const prefByUser = await getNotifyMilestonesPrefs(userIds);
  const countByUser = new Map<string, number>();

  // Chunk the IN lists so no statement exceeds a safe parameter count.
  const IN_CHUNK = 900;
  for (let i = 0; i < userIds.length; i += IN_CHUNK) {
    const chunk = userIds.slice(i, i + IN_CHUNK);
    const placeholders = chunk.map(() => "?").join(",");
    const countRows = (await db
      .prepare(
        `SELECT user_id, COUNT(*) AS n FROM notifications
         WHERE user_id IN (${placeholders}) AND substr(created_at, 1, 10) = ?
         GROUP BY user_id`
      )
      .all(...chunk, todayUTC())) as unknown as {
      user_id: string;
      n: number;
    }[];
    for (const r of countRows) countByUser.set(r.user_id, r.n);
  }

  // Decide in order, simulating the incremental counter exactly as
  // sequential createNotification calls would see it.
  const passing: { index: number; id: string; item: NotificationBatchItem }[] =
    [];
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (!(prefByUser.get(item.userId) ?? true)) continue; // pref_off
    const count = countByUser.get(item.userId) ?? 0;
    if (count >= NOTIFICATIONS_PER_DAY) {
      console.info(
        `[notifications] rate cap hit for user ${item.userId}; dropping ${item.type}`
      );
      continue;
    }
    countByUser.set(item.userId, count + 1);
    passing.push({ index, id: newId(), item });
  }

  const INSERT_CHUNK = 250;
  for (let i = 0; i < passing.length; i += INSERT_CHUNK) {
    const chunk = passing.slice(i, i + INSERT_CHUNK);
    const values = chunk.map(() => "(?, ?, ?, ?, ?, ?)").join(",");
    const args: (string | null)[] = chunk.flatMap((p) => [
      p.id,
      p.item.userId,
      p.item.type,
      p.item.title,
      p.item.body,
      p.item.link ?? null,
    ]);
    await db
      .prepare(
        `INSERT INTO notifications (id, user_id, type, title, body, link)
         VALUES ${values}`
      )
      .run(...args);
  }
  for (const p of passing) createdFlags[p.index] = true;
  return { created: passing.length, createdFlags };
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
