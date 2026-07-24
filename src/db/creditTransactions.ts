import { db } from "./client";
import { newId } from "@/lib/id";

// Append-only ledger. This is the ONLY place Reputation Credits are
// created — always server-side, always tied to a specific completed
// Payment. UNIQUE(payment_id) means the same Stripe event can be
// delivered/retried any number of times and credits are only ever
// granted once (idempotent by construction).
// createdAt is an optional override used only by the demo seed data.
export async function creditProfileForPayment(params: {
  profileId: string;
  rankingId: string;
  supporterUserId: string;
  paymentId: string;
  credits: number;
  createdAt?: string;
}): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO credit_transactions
        (id, profile_id, ranking_id, supporter_user_id, payment_id, credits, created_at)
       VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`
    )
    .run(
      newId(),
      params.profileId,
      params.rankingId,
      params.supporterUserId,
      params.paymentId,
      params.credits,
      params.createdAt ?? null
    );
  return result.changes > 0;
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
