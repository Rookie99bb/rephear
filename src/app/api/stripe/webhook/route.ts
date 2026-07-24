import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeClient, getWebhookSecret } from "@/lib/stripe";
import {
  findPaymentBySessionId,
  findPaymentByPaymentIntentId,
  markPaymentCompleted,
  markPaymentStatus,
  markPaymentRefunded,
} from "@/db/payments";
import {
  creditProfileForPayment,
  reverseCreditsForPayment,
} from "@/db/creditTransactions";

// Stripe requires the raw request body (not JSON-parsed) to verify the
// webhook signature. Next.js App Router route handlers give us that via
// request.text() by default — nothing extra to configure.
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      getWebhookSecret()
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const payment = await findPaymentBySessionId(session.id);
      if (!payment) break;
      if (payment.status !== "completed") {
        await markPaymentCompleted(
          payment.id,
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null
        );
      }
      // UNIQUE(payment_id) on credit_transactions makes this safe to run
      // even if Stripe redelivers the same event.
      await creditProfileForPayment({
        profileId: payment.profileId,
        rankingId: payment.rankingId,
        supporterUserId: payment.userId,
        paymentId: payment.id,
        credits: payment.credits,
      });
      break;
    }
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const payment = await findPaymentBySessionId(session.id);
      if (payment) {
        await markPaymentStatus(payment.id, "cancelled");
      }
      break;
    }
    // Security-audit fix: previously unhandled. A refund or a won
    // chargeback both mean Stripe has taken the money back, but until
    // now nothing here ever revoked the Credits that were granted when
    // the payment first completed — they stayed on the Nominee's total
    // forever even after the supporter got their money back. Both cases
    // do the same two things: stop counting this payment as "completed"
    // (so it drops out of Support Given / totalPurchased, which already
    // filter on that status) and zero out the Credits it granted (so it
    // drops out of every leaderboard/received-credits total too).
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id ?? null;
      if (paymentIntentId) {
        const payment = await findPaymentByPaymentIntentId(paymentIntentId);
        if (payment && payment.status === "completed") {
          await markPaymentRefunded(payment.id, "refunded");
          await reverseCreditsForPayment(payment.id);
        }
      }
      break;
    }
    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      const paymentIntentId =
        typeof dispute.payment_intent === "string"
          ? dispute.payment_intent
          : dispute.payment_intent?.id ?? null;
      if (paymentIntentId) {
        const payment = await findPaymentByPaymentIntentId(paymentIntentId);
        if (payment && payment.status === "completed") {
          await markPaymentRefunded(payment.id, "disputed");
          await reverseCreditsForPayment(payment.id);
        }
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
