import { db } from "./client";
import { newId } from "@/lib/id";
import type { Visibility } from "@/lib/types";
import { seedAccountExclusion } from "./visibility";

// Append-only ledger. This is the ONLY place Reputation Credits are
// created — always server-side, always tied to a specific completed
// Payment. UNIQUE(payment_id) means the same Stripe event can be
// delivered/retried any number of times and credits are only ever
// granted once (idempotent by construction).
// createdAt is an optional override used only by the demo seed data.
//
// visibility: the supporter's choice from the Support page
// ("Show that I back X on my profile" vs "Keep private"), carried
// through the payments row by the Stripe webhook. NULL = inherit the
// user's account default at read time (see src/db/visibility.ts).
// It NEVER affects ranking totals — see the SUM() read sites, which
// deliberately do not filter on it.
export async function creditProfileForPayment(params: {
  profileId: string;
  rankingId: string;
  supporterUserId: string;
  paymentId: string;
  credits: number;
  visibility?: Visibility | null;
  createdAt?: string;
}): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO credit_transactions
        (id, profile_id, ranking_id, supporter_user_id, payment_id, credits, visibility, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`
    )
    .run(
      newId(),
      params.profileId,
      params.rankingId,
      params.supporterUserId,
      params.paymentId,
      params.credits,
      params.visibility ?? null,
      params.createdAt ?? null
    );
  return result.changes > 0;
}

// Security-audit fix: the other half of markPaymentRefunded (see
// payments.ts). Zeroes out the credits this payment granted, instead of
// deleting the row or inserting an offsetting negative row, specifically
// so every existing SUM(credits) read site (leaderboards.ts, rankings.ts,
// digest.ts, creditsHistory.ts, adminStats.ts, profiles.ts) keeps working
// completely unchanged — a refunded payment's row still exists (so the
// original grant is still visible/auditable via refunded_at), it just no
// longer contributes to anyone's total. `WHERE refunded_at IS NULL` makes
// this idempotent: Stripe redelivering the same refund/dispute webhook
// just no-ops on the second delivery instead of doing anything twice.
export async function reverseCreditsForPayment(paymentId: string): Promise<void> {
  await db
    .prepare(
      `UPDATE credit_transactions
       SET credits = 0, refunded_at = datetime('now')
       WHERE payment_id = ? AND refunded_at IS NULL`
    )
    .run(paymentId);
}

export interface SupportedItem {
  rankingId: string;
  rankingTitle: string;
  profileId: string;
  profileName: string;
  totalCredits: number;
  lastSupportedAt: string;
}

// One row per (Ranking, Nominee) this user has ever backed with paid
// Reputation Credits — powers the "Rankings you've supported" section on
// the user's own Settings page. Aggregates every completed payment's
// credit grant, so supporting the same Nominee more than once still
// shows as a single row with a combined credit total. Excludes a
// Ranking/Nominee that's since been soft-deleted so the list never
// links to something that 404s.
export async function supportedItemsForUser(
  userId: string
): Promise<SupportedItem[]> {
  const rows = (await db
    .prepare(
      `SELECT ct.ranking_id, r.title AS ranking_title, ct.profile_id,
              p.name AS profile_name, SUM(ct.credits) AS total_credits,
              MAX(ct.created_at) AS last_supported_at
       FROM credit_transactions ct
       JOIN rankings r ON r.id = ct.ranking_id
       JOIN profiles p ON p.id = ct.profile_id
       WHERE ct.supporter_user_id = ? AND r.deleted_at IS NULL AND p.deleted_at IS NULL
       GROUP BY ct.ranking_id, ct.profile_id
       ORDER BY last_supported_at DESC`
    )
    .all(userId)) as unknown as {
    ranking_id: string;
    ranking_title: string;
    profile_id: string;
    profile_name: string;
    total_credits: number;
    last_supported_at: string;
  }[];
  return rows.map((r) => ({
    rankingId: r.ranking_id,
    rankingTitle: r.ranking_title,
    profileId: r.profile_id,
    profileName: r.profile_name,
    totalCredits: r.total_credits,
    lastSupportedAt: r.last_supported_at,
  }));
}

export interface PublicSupporter {
  userId: string;
  name: string;
}

export interface SupporterSummary {
  // Distinct real supporters with a net-positive credit balance.
  // Private supporters are INCLUDED here — privacy affects identity
  // visibility, never ranking contribution (§10 equality).
  totalSupporters: number;
  // Only supporters whose EFFECTIVE visibility is 'public'
  // (COALESCE(ct.visibility, u.show_supports)), seed accounts excluded,
  // ordered by first support. Render as "Emma · James · Alex · +N
  // others" where N = totalSupporters - shown — NEVER as "N private
  // supporters" and never with any private identity attached.
  publicSupporters: PublicSupporter[];
}

// Privacy-safe supporter list building block (Phase 2 renders it on
// nominee pages). Private supporters contribute to totalSupporters but
// their identities can never appear in publicSupporters — they are
// excluded in the JOIN, not filtered in UI, so no response, log, or
// hover-card can ever leak them.
export async function getSupporterSummary(
  rankingId: string,
  profileId: string,
  limit: number
): Promise<SupporterSummary> {
  const seedExcl = seedAccountExclusion("u");
  const totalRow = (await db
    .prepare(
      `SELECT COUNT(DISTINCT ct.supporter_user_id) AS n
       FROM credit_transactions ct
       JOIN users u ON u.id = ct.supporter_user_id
       WHERE ct.ranking_id = ? AND ct.profile_id = ?
         AND ct.credits > 0 AND ${seedExcl}`
    )
    .get(rankingId, profileId)) as unknown as { n: number } | undefined;

  const rows = (await db
    .prepare(
      `SELECT DISTINCT ct.supporter_user_id AS user_id, u.name AS name,
              MIN(ct.created_at) AS first_supported_at
       FROM credit_transactions ct
       JOIN users u ON u.id = ct.supporter_user_id
       WHERE ct.ranking_id = ? AND ct.profile_id = ?
         AND ct.credits > 0
         AND COALESCE(ct.visibility, u.show_supports, 'public') = 'public'
         AND ${seedExcl}
       GROUP BY ct.supporter_user_id
       ORDER BY first_supported_at ASC
       LIMIT ?`
    )
    .all(rankingId, profileId, limit)) as unknown as {
    user_id: string;
    name: string;
  }[];

  return {
    totalSupporters: totalRow?.n ?? 0,
    publicSupporters: rows.map((r) => ({ userId: r.user_id, name: r.name })),
  };
}
