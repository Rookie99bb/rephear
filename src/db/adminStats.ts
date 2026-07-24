import { db } from "./client";

// Everything on the /admin/analytics dashboard (feature 2) is a plain
// derived read over existing tables — same "no separate analytics
// system" philosophy listTrendingRankings already uses for the public
// leaderboards. Nothing here is cached or pre-aggregated, so it's always
// exactly up to date with the database, at the cost of a handful of
// extra queries whenever an admin loads the page — fine at MVP scale.

export interface RegionStat {
  country: string;
  city: string;
  rankingCount: number;
  likeCount: number;
}

export interface DayCount {
  day: string; // YYYY-MM-DD
  count: number;
}

export interface HourCount {
  hour: string; // "00".."23"
  count: number;
}

export interface AdminStats {
  totalUsers: number;
  totalActiveRankings: number;
  totalHiddenOrDeletedRankings: number;
  totalLikes: number;
  totalShares: number;
  totalCompletedSupportCount: number;
  totalSupportAmountCents: number;
  totalCreditsGranted: number;
  regionBreakdown: RegionStat[];
  signupsByDay: DayCount[];
  activityByDay: DayCount[];
  activityByHour: HourCount[];
}

async function scalar(sql: string): Promise<number> {
  const row = (await db.prepare(sql).get()) as unknown as
    | { c: number }
    | undefined;
  return row?.c ?? 0;
}

export async function getAdminStats(): Promise<AdminStats> {
  const [
    totalUsers,
    totalActiveRankings,
    totalHiddenOrDeletedRankings,
    totalLikes,
    totalShares,
    totalCompletedSupportCount,
    totalSupportAmountCents,
    totalCreditsGranted,
  ] = await Promise.all([
    scalar("SELECT COUNT(*) AS c FROM users"),
    scalar(
      "SELECT COUNT(*) AS c FROM rankings WHERE is_hidden = 0 AND deleted_at IS NULL"
    ),
    scalar(
      "SELECT COUNT(*) AS c FROM rankings WHERE is_hidden = 1 OR deleted_at IS NOT NULL"
    ),
    scalar("SELECT COALESCE(SUM(count), 0) AS c FROM likes"),
    scalar("SELECT COUNT(*) AS c FROM shares"),
    scalar("SELECT COUNT(*) AS c FROM payments WHERE status = 'completed'"),
    scalar(
      "SELECT COALESCE(SUM(amount_cents), 0) AS c FROM payments WHERE status = 'completed'"
    ),
    scalar("SELECT COALESCE(SUM(credits), 0) AS c FROM credit_transactions"),
  ]);

  const regionRows = (await db
    .prepare(
      `SELECT r.country AS country, r.city AS city,
        COUNT(DISTINCT r.id) AS ranking_count,
        COALESCE((
          SELECT SUM(l.count) FROM likes l
          WHERE l.ranking_id IN (
            SELECT id FROM rankings r2 WHERE r2.country = r.country AND r2.city = r.city
          )
        ), 0) AS like_count
       FROM rankings r
       WHERE r.deleted_at IS NULL
       GROUP BY r.country, r.city
       ORDER BY ranking_count DESC, like_count DESC`
    )
    .all()) as unknown as {
    country: string;
    city: string;
    ranking_count: number;
    like_count: number;
  }[];

  const signupRows = (await db
    .prepare(
      `SELECT date(created_at) AS day, COUNT(*) AS c
       FROM users
       WHERE created_at >= datetime('now', '-30 days')
       GROUP BY day
       ORDER BY day ASC`
    )
    .all()) as unknown as { day: string; c: number }[];

  const activityDayRows = (await db
    .prepare(
      `SELECT date(created_at) AS day, COUNT(*) AS c FROM (
         SELECT created_at FROM likes
         UNION ALL
         SELECT created_at FROM shares
       )
       WHERE created_at >= datetime('now', '-30 days')
       GROUP BY day
       ORDER BY day ASC`
    )
    .all()) as unknown as { day: string; c: number }[];

  const activityHourRows = (await db
    .prepare(
      `SELECT strftime('%H', created_at) AS hour, COUNT(*) AS c FROM (
         SELECT created_at FROM likes
         UNION ALL
         SELECT created_at FROM shares
       )
       GROUP BY hour
       ORDER BY hour ASC`
    )
    .all()) as unknown as { hour: string; c: number }[];

  return {
    totalUsers,
    totalActiveRankings,
    totalHiddenOrDeletedRankings,
    totalLikes,
    totalShares,
    totalCompletedSupportCount,
    totalSupportAmountCents,
    totalCreditsGranted,
    regionBreakdown: regionRows.map((r) => ({
      country: r.country,
      city: r.city,
      rankingCount: r.ranking_count,
      likeCount: r.like_count,
    })),
    signupsByDay: signupRows.map((r) => ({ day: r.day, count: r.c })),
    activityByDay: activityDayRows.map((r) => ({ day: r.day, count: r.c })),
    activityByHour: activityHourRows.map((r) => ({
      hour: r.hour,
      count: r.c,
    })),
  };
}
