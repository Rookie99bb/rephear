import { db } from "./client";
import { newId } from "@/lib/id";
import type { Payment, PaymentStatus } from "@/lib/types";

interface PaymentRow {
  id: string;
  user_id: string;
  ranking_id: string;
  profile_id: string;
  package_id: string;
  credits: number;
  amount_cents: number;
  currency: string;
  stripe_checkout_session_id: string;
  stripe_payment_intent_id: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
}

function toPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    userId: row.user_id,
    rankingId: row.ranking_id,
    profileId: row.profile_id,
    packageId: row.package_id,
    credits: row.credits,
    amountCents: row.amount_cents,
    currency: row.currency,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    status: row.status as PaymentStatus,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

// A payment row is created the moment a Stripe Checkout Session is
// created — *before* the user has paid — so every attempt is recorded,
// not just successful ones.
// createdAt is an optional override used only by the demo seed data.
export function createPendingPayment(params: {
  userId: string;
  rankingId: string;
  profileId: string;
  packageId: string;
  credits: number;
  amountCents: number;
  currency: string;
  stripeCheckoutSessionId: string;
  createdAt?: string;
}): Payment {
  const id = newId();
  db.prepare(
    `INSERT INTO payments
      (id, user_id, ranking_id, profile_id, package_id, credits, amount_cents, currency, stripe_checkout_session_id, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', COALESCE(?, datetime('now')))`
  ).run(
    id,
    params.userId,
    params.rankingId,
    params.profileId,
    params.packageId,
    params.credits,
    params.amountCents,
    params.currency,
    params.stripeCheckoutSessionId,
    params.createdAt ?? null
  );
  return findPaymentById(id)!;
}

export function findPaymentById(id: string): Payment | null {
  const row = db
    .prepare("SELECT * FROM payments WHERE id = ?")
    .get(id) as unknown as PaymentRow | undefined;
  return row ? toPayment(row) : null;
}

export function findPaymentBySessionId(sessionId: string): Payment | null {
  const row = db
    .prepare("SELECT * FROM payments WHERE stripe_checkout_session_id = ?")
    .get(sessionId) as unknown as PaymentRow | undefined;
  return row ? toPayment(row) : null;
}

// completedAt is an optional override used only by the demo seed data.
export function markPaymentCompleted(
  paymentId: string,
  stripePaymentIntentId: string | null,
  completedAt?: string
): void {
  db.prepare(
    `UPDATE payments
     SET status = 'completed', stripe_payment_intent_id = ?, completed_at = COALESCE(?, datetime('now'))
     WHERE id = ? AND status != 'completed'`
  ).run(stripePaymentIntentId, completedAt ?? null, paymentId);
}

export function markPaymentStatus(
  paymentId: string,
  status: Extract<PaymentStatus, "failed" | "cancelled">
): void {
  db.prepare(
    `UPDATE payments SET status = ? WHERE id = ? AND status = 'pending'`
  ).run(status, paymentId);
}
