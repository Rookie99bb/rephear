import { db } from "./client";
import type { MoneyByCurrency } from "@/lib/money";

// Admin-only, read-only aggregate views over EXISTING tables (likes,
// payments, rankings, profiles, claim_requests) — no new storage, same
// "no separate analytics system" approach src/db/adminStats.ts already
// uses for the Admin > Analytics dashboard. Used by the Admin > Users
// list (bulk summaries, one aggregate query per activity type — never
// per user, so the page stays fast regardless of user count) and the
// Admin > Users > [id] detail page (single-user summary + full activity
// history).
//
// Authoritative sources, and why:
// - Likes Given: likes.count summed per user. A user gets exactly one
//   row per (ranking, profile) — see the UNIQUE constraint in
//   src/db/schema.ts — and repeat Likes unlocked by sharing increment
//   that same row's `count` rather than inserting new rows (see
//   incrementLike in src/db/likes.ts). Summing `count` is therefore the
//   authoritative total and can never double-count.
// - Support Given: payments.amount_cents, ONLY WHERE status =
//   'completed'. Pending/failed/cancelled payments are excluded by that
//   filter. There is currently no refund status anywhere in this
//   schema/codebase, so there is nothing to subtract back out — if
//   refunds are added later, this WHERE clause is the one place that
//   will need an additional exclusion. Grouped by currency so different
//   currencies are never summed together (see src/lib/money.ts).
// - Rankings Created / Nominations Made: rankings.created_by /
//   profiles.added_by, counted regardless of later moderation
//   (is_hidden/deleted_at) — the user really did perform that action,
//   moderation is a separate concern from whether the action happened.
// - Claims Submitted: claim_requests.applicant_user_id — this table is
//   never deleted (see src/db/claimRequests.ts), so it's a reliable,
//   complete history.

export interface UserEngagementSummary {
  likesGiven: number;
  supportAmounts: MoneyByCurrency[];
  supportActionsCount: number;
  rankingsCreated: number;
  nominationsMade: number;
  claimsSubmitted: number;
  // Meaningful product actions only (Likes + successful Support +
  // Rankings created + Nominations made + Claims submitted) —
  // deliberately excludes technical events like logins or page views.
  activityCount: number;
}

function emptySummary(): UserEngagementSummary {
  return {
    likesGiven: 0,
    supportAmounts: [],
    supportActionsCount: 0,
    rankingsCreated: 0,
    nominationsMade: 0,
    claimsSubmitted: 0,
    activityCount: 0,
  };
}

// Bulk version for the Registered Users list: exactly 6 aggregate
// queries total, independent of how many users exist — not one query
// (or five) per row. See the performance note above.
export async function getUserEngagementSummaries(): Promise<
  Map<string, UserEngagementSummary>
> {
  const [likeRows, supportAmountRows, supportCountRows, rankingRows, nominationRows, claimRows] =
    await Promise.all([
      db.prepare(`SELECT user_id, SUM(count) AS c FROM likes GROUP BY user_id`).all(),
      db
        .prepare(
          `SELECT user_id, currency, SUM(amount_cents) AS amount_cents
           FROM payments WHERE status = 'completed' GROUP BY user_id, currency`
        )
        .all(),
      db
        .prepare(
          `SELECT user_id, COUNT(*) AS c FROM payments WHERE status = 'completed' GROUP BY user_id`
        )
        .all(),
      db
        .prepare(`SELECT created_by AS user_id, COUNT(*) AS c FROM rankings GROUP BY created_by`)
        .all(),
      db
        .prepare(`SELECT added_by AS user_id, COUNT(*) AS c FROM profiles GROUP BY added_by`)
        .all(),
      db
        .prepare(
          `SELECT applicant_user_id AS user_id, COUNT(*) AS c FROM claim_requests GROUP BY applicant_user_id`
        )
        .all(),
    ]);

  const summaries = new Map<string, UserEngagementSummary>();
  function get(userId: string): UserEngagementSummary {
    let s = summaries.get(userId);
    if (!s) {
      s = emptySummary();
      summaries.set(userId, s);
    }
    return s;
  }

  for (const row of likeRows as unknown as { user_id: string; c: number }[]) {
    get(row.user_id).likesGiven = row.c;
  }
  for (const row of supportAmountRows as unknown as {
    user_id: string;
    currency: string;
    amount_cents: number;
  }[]) {
    get(row.user_id).supportAmounts.push({
      currency: row.currency,
      amountCents: row.amount_cents,
    });
  }
  for (const row of supportCountRows as unknown as { user_id: string; c: number }[]) {
    get(row.user_id).supportActionsCount = row.c;
  }
  for (const row of rankingRows as unknown as { user_id: string; c: number }[]) {
    get(row.user_id).rankingsCreated = row.c;
  }
  for (const row of nominationRows as unknown as { user_id: string; c: number }[]) {
    get(row.user_id).nominationsMade = row.c;
  }
  for (const row of claimRows as unknown as { user_id: string; c: number }[]) {
    get(row.user_id).claimsSubmitted = row.c;
  }

  for (const s of summaries.values()) {
    s.activityCount =
      s.likesGiven +
      s.supportActionsCount +
      s.rankingsCreated +
      s.nominationsMade +
      s.claimsSubmitted;
  }

  return summaries;
}

// Single-user version for the Admin > Users > [id] detail page —
// filters with WHERE instead of scanning every user's rows.
export async function getUserEngagementSummary(
  userId: string
): Promise<UserEngagementSummary> {
  const [likeRow, supportAmountRows, supportCountRow, rankingRow, nominationRow, claimRow] =
    await Promise.all([
      db.prepare(`SELECT COALESCE(SUM(count), 0) AS c FROM likes WHERE user_id = ?`).get(userId),
      db
        .prepare(
          `SELECT currency, SUM(amount_cents) AS amount_cents
           FROM payments WHERE user_id = ? AND status = 'completed' GROUP BY currency`
        )
        .all(userId),
      db
        .prepare(`SELECT COUNT(*) AS c FROM payments WHERE user_id = ? AND status = 'completed'`)
        .get(userId),
      db.prepare(`SELECT COUNT(*) AS c FROM rankings WHERE created_by = ?`).get(userId),
      db.prepare(`SELECT COUNT(*) AS c FROM profiles WHERE added_by = ?`).get(userId),
      db
        .prepare(`SELECT COUNT(*) AS c FROM claim_requests WHERE applicant_user_id = ?`)
        .get(userId),
    ]);

  const likesGiven = (likeRow as unknown as { c: number }).c;
  const supportAmounts = (
    supportAmountRows as unknown as { currency: string; amount_cents: number }[]
  ).map((r) => ({ currency: r.currency, amountCents: r.amount_cents }));
  const supportActionsCount = (supportCountRow as unknown as { c: number }).c;
  const rankingsCreated = (rankingRow as unknown as { c: number }).c;
  const nominationsMade = (nominationRow as unknown as { c: number }).c;
  const claimsSubmitted = (claimRow as unknown as { c: number }).c;

  return {
    likesGiven,
    supportAmounts,
    supportActionsCount,
    rankingsCreated,
    nominationsMade,
    claimsSubmitted,
    activityCount:
      likesGiven + supportActionsCount + rankingsCreated + nominationsMade + claimsSubmitted,
  };
}

export type UserActivityEntry =
  | {
      type: "like";
      createdAt: string;
      count: number;
      rankingId: string;
      rankingTitle: string;
      rankingLinkable: boolean;
      city: string;
      country: string;
      profileId: string;
      profileName: string;
    }
  | {
      type: "support";
      createdAt: string;
      amountCents: number;
      currency: string;
      credits: number;
      rankingId: string;
      rankingTitle: string;
      rankingLinkable: boolean;
      city: string;
      country: string;
      profileId: string;
      profileName: string;
    }
  | {
      type: "ranking_created";
      createdAt: string;
      rankingId: string;
      rankingTitle: string;
      rankingLinkable: boolean;
      city: string;
      country: string;
    }
  | {
      type: "nomination";
      createdAt: string;
      rankingId: string;
      rankingTitle: string;
      rankingLinkable: boolean;
      city: string;
      country: string;
      profileId: string;
      profileName: string;
    }
  | {
      type: "claim";
      createdAt: string;
      status: "pending" | "more_info_required" | "approved" | "rejected" | "closed";
      profileId: string;
      profileName: string;
    };

interface LikeActivityRow {
  created_at: string;
  count: number;
  ranking_id: string;
  ranking_title: string;
  ranking_linkable: number;
  city: string;
  country: string;
  profile_id: string;
  profile_name: string;
}

interface SupportActivityRow {
  created_at: string;
  amount_cents: number;
  currency: string;
  credits: number;
  ranking_id: string;
  ranking_title: string;
  ranking_linkable: number;
  city: string;
  country: string;
  profile_id: string;
  profile_name: string;
}

interface RankingCreatedRow {
  created_at: string;
  ranking_id: string;
  ranking_title: string;
  ranking_linkable: number;
  city: string;
  country: string;
}

interface NominationRow {
  created_at: string;
  ranking_id: string;
  ranking_title: string;
  ranking_linkable: number;
  city: string;
  country: string;
  profile_id: string;
  profile_name: string;
}

interface ClaimActivityRow {
  created_at: string;
  status: string;
  profile_id: string;
  profile_name: string;
}

// "Linkable" = not hidden and not soft-deleted. The public /rankings/[id]
// route 404s a hidden/deleted Ranking for anyone whose admin status it
// can't confirm as DB-driven (it currently checks the ADMIN_EMAILS env
// allowlist, not users.is_admin — a pre-existing inconsistency outside
// this feature's scope to fix), so an admin who was only ever granted
// access via this same Users page could hit a broken link. Rather than
// touch that unrelated route, activity entries just fall back to plain
// (non-link) text whenever the target isn't safely linkable — "do not
// create broken links" wins over "link everything".
function linkableExpr(rankingAlias: string): string {
  return `(${rankingAlias}.deleted_at IS NULL AND ${rankingAlias}.is_hidden = 0)`;
}

// Merged, reverse-chronological feed of every meaningful action this
// user has taken — powers the Admin > Users > [id] "Activity History"
// section. Five small WHERE-filtered queries (one per activity type),
// merged and sorted in memory; fine at MVP per-user scale, same
// trade-off the rest of this admin panel already makes.
export async function getUserActivityHistory(
  userId: string,
  limit = 200
): Promise<UserActivityEntry[]> {
  const [likeRows, supportRows, rankingRows, nominationRows, claimRows] = await Promise.all([
    db
      .prepare(
        `SELECT l.created_at, l.count, l.ranking_id, r.title AS ranking_title,
                ${linkableExpr("r")} AS ranking_linkable,
                r.city, r.country, l.profile_id, p.name AS profile_name
         FROM likes l
         JOIN rankings r ON r.id = l.ranking_id
         JOIN profiles p ON p.id = l.profile_id
         WHERE l.user_id = ?`
      )
      .all<LikeActivityRow>(userId),
    db
      .prepare(
        `SELECT COALESCE(pay.completed_at, pay.created_at) AS created_at,
                pay.amount_cents, pay.currency, pay.credits,
                pay.ranking_id, r.title AS ranking_title,
                ${linkableExpr("r")} AS ranking_linkable,
                r.city, r.country, pay.profile_id, p.name AS profile_name
         FROM payments pay
         JOIN rankings r ON r.id = pay.ranking_id
         JOIN profiles p ON p.id = pay.profile_id
         WHERE pay.user_id = ? AND pay.status = 'completed'`
      )
      .all<SupportActivityRow>(userId),
    db
      .prepare(
        `SELECT created_at, id AS ranking_id, title AS ranking_title,
                ${linkableExpr("rankings")} AS ranking_linkable, city, country
         FROM rankings WHERE created_by = ?`
      )
      .all<RankingCreatedRow>(userId),
    db
      .prepare(
        `SELECT p.created_at, p.ranking_id, r.title AS ranking_title,
                ${linkableExpr("r")} AS ranking_linkable,
                r.city, r.country, p.id AS profile_id, p.name AS profile_name
         FROM profiles p
         JOIN rankings r ON r.id = p.ranking_id
         WHERE p.added_by = ?`
      )
      .all<NominationRow>(userId),
    db
      .prepare(
        `SELECT cr.submitted_at AS created_at, cr.status, cr.profile_id, p.name AS profile_name
         FROM claim_requests cr
         JOIN profiles p ON p.id = cr.profile_id
         WHERE cr.applicant_user_id = ?`
      )
      .all<ClaimActivityRow>(userId),
  ]);

  const entries: UserActivityEntry[] = [];

  for (const r of likeRows) {
    entries.push({
      type: "like",
      createdAt: r.created_at,
      count: r.count,
      rankingId: r.ranking_id,
      rankingTitle: r.ranking_title,
      rankingLinkable: !!r.ranking_linkable,
      city: r.city,
      country: r.country,
      profileId: r.profile_id,
      profileName: r.profile_name,
    });
  }
  for (const r of supportRows) {
    entries.push({
      type: "support",
      createdAt: r.created_at,
      amountCents: r.amount_cents,
      currency: r.currency,
      credits: r.credits,
      rankingId: r.ranking_id,
      rankingTitle: r.ranking_title,
      rankingLinkable: !!r.ranking_linkable,
      city: r.city,
      country: r.country,
      profileId: r.profile_id,
      profileName: r.profile_name,
    });
  }
  for (const r of rankingRows) {
    entries.push({
      type: "ranking_created",
      createdAt: r.created_at,
      rankingId: r.ranking_id,
      rankingTitle: r.ranking_title,
      rankingLinkable: !!r.ranking_linkable,
      city: r.city,
      country: r.country,
    });
  }
  for (const r of nominationRows) {
    entries.push({
      type: "nomination",
      createdAt: r.created_at,
      rankingId: r.ranking_id,
      rankingTitle: r.ranking_title,
      rankingLinkable: !!r.ranking_linkable,
      city: r.city,
      country: r.country,
      profileId: r.profile_id,
      profileName: r.profile_name,
    });
  }
  for (const r of claimRows) {
    entries.push({
      type: "claim",
      createdAt: r.created_at,
      status: r.status as "pending" | "more_info_required" | "approved" | "rejected" | "closed",
      profileId: r.profile_id,
      profileName: r.profile_name,
    });
  }

  entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return entries.slice(0, limit);
}
