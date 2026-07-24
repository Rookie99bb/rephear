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
export async function createPendingPayment(params: {
  userId: string;
  rankingId: string;
  profileId: string;
  packageId: string;
  credits: number;
  amountCents: number;
  currency: string;
  stripeCheckoutSessionId: string;
  createdAt?: string;
}): Promise<Payment> {
  const id = newId();
  await db
    .prepare(
      `INSERT INTO payments
      (id, user_id, ranking_id, profile_id, package_id, credits, amount_cents, currency, stripe_checkout_session_id, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', COALESCE(?, datetime('now')))`
    )
    .run(
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
  return (await findPaymentById(id))!;
}

export async function findPaymentById(id: string): Promise<Payment | null> {
  const row = (await db
    .prepare("SELECT * FROM payments WHERE id = ?")
    .get(id)) as unknown as PaymentRow | undefined;
  return row ? toPayment(row) : null;
}

export async function findPaymentBySessionId(sessionId: string): Promise<Payment | null> {
  const row = (await db
    .prepare("SELECT * FROM payments WHERE stripe_checkout_session_id = ?")
    .get(sessionId)) as unknown as PaymentRow | undefined;
  return row ? toPayment(row) : null;
}

// completedAt is an optional override used only by the demo seed data.
export async function markPaymentCompleted(
  paymentId: string,
  stripePaymentIntentId: string | null,
  completedAt?: string
): Promise<void> {
  // Security-audit fix: was `WHERE id = ? AND status != 'completed'`,
  // which meant a *late or redelivered* "checkout.session.completed"
  // webhook arriving after a refund/dispute had already been processed
  // (Stripe doesn't guarantee delivery order, and will retry an event
  // that failed to deliver the first time) would flip the payment back
  // to 'completed' — wrong, since Stripe really did take the money back
  // in the meantime. It never re-granted Credits (creditProfileForPayment
  // is idempotent via the credit_transactions UNIQUE(payment_id)
  // constraint), but it would have wrongly counted the payment as
  // "completed" again in Support Given / totalPurchased, which filter on
  // that status. Narrowing the guard to only fire from 'pending' (the
  // only state a real first-time completion should ever come from) fixes
  // this without changing the normal-path behavior at all.
  await db
    .prepare(
      `UPDATE payments
     SET status = 'completed', stripe_payment_intent_id = ?, completed_at = COALESCE(?, datetime('now'))
     WHERE id = ? AND status = 'pending'`
    )
    .run(stripePaymentIntentId, completedAt ?? null, paymentId);
}

export async function markPaymentStatus(
  paymentId: string,
  status: Extract<PaymentStatus, "failed" | "cancelled">
): Promise<void> {
  await db
    .prepare(`UPDATE payments SET status = ? WHERE id = ? AND status = 'pending'`)
    .run(status, paymentId);
}

// Stripe includes payment_intent on both Charge and Dispute event
// objects, and it's what we already store on the payment the moment
// checkout completes (see markPaymentCompleted) — so a refund/dispute
// webhook can find "which of our payments is this about" without a
// second, unnecessary API call back to Stripe.
export async function findPaymentByPaymentIntentId(
  paymentIntentId: string
): Promise<Payment | null> {
  const row = (await db
    .prepare("SELECT * FROM payments WHERE stripe_payment_intent_id = ?")
    .get(paymentIntentId)) as unknown as PaymentRow | undefined;
  return row ? toPayment(row) : null;
}

// Security-audit fix: previously nothing ever transitioned a payment out
// of 'completed' in response to a refund or chargeback, so Credits
// granted for it stayed granted forever even after Stripe took the money
// back. Only ever moves 'completed' -> 'refunded'/'disputed' (the WHERE
// guard makes this replay-safe: Stripe redelivering the same webhook
// event just no-ops the second time instead of erroring or re-reversing
// anything). See reverseCreditsForPayment in creditTransactions.ts for
// the other half of this — actually zeroing out the Credits themselves.
export async function markPaymentRefunded(
  paymentId: string,
  status: Extract<PaymentStatus, "refunded" | "disputed">
): Promise<void> {
  await db
    .prepare(`UPDATE payments SET status = ? WHERE id = ? AND status = 'completed'`)
    .run(status, paymentId);
}
