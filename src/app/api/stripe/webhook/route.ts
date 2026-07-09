import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeClient, getWebhookSecret } from "@/lib/stripe";
import {
  findPaymentBySessionId,
  markPaymentCompleted,
  markPaymentStatus,
} from "@/db/payments";
import { creditProfileForPayment } from "@/db/creditTransactions";

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
      const payment = findPaymentBySessionId(session.id);
      if (!payment) break;
      if (payment.status !== "completed") {
        markPaymentCompleted(
          payment.id,
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null
        );
      }
      // UNIQUE(payment_id) on credit_transactions makes this safe to run
      // even if Stripe redelivers the same event.
      creditProfileForPayment({
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
      const payment = findPaymentBySessionId(session.id);
      if (payment) {
        markPaymentStatus(payment.id, "cancelled");
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
