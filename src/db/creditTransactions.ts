import { db } from "./client";
import { newId } from "@/lib/id";

// Append-only ledger. This is the ONLY place Reputation Credits are
// created — always server-side, always tied to a specific completed
// Payment. UNIQUE(payment_id) means the same Stripe event can be
// delivered/retried any number of times and credits are only ever
// granted once (idempotent by construction).
// createdAt is an optional override used only by the demo seed data.
export function creditProfileForPayment(params: {
  profileId: string;
  rankingId: string;
  supporterUserId: string;
  paymentId: string;
  credits: number;
  createdAt?: string;
}): boolean {
  const result = db
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
