import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getStripeClient } from "@/lib/stripe";
import { findCreditPackage } from "@/lib/creditPackages";
import { findRankingById } from "@/db/rankings";
import { findProfileById } from "@/db/profiles";
import { createPendingPayment } from "@/db/payments";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit";

// Creates a real Stripe Checkout Session (test mode while STRIPE_SECRET_KEY
// is a test key) for purchasing Reputation Credits in support of one
// Nominee within one Ranking. The frontend never decides how many credits
// are granted — that comes from the server-side package config.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!checkRateLimit(`support:${user.id}`, RATE_LIMITS.support)) {
    return NextResponse.json(
      { error: "Too many Support attempts — please slow down and try again shortly." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const rankingId = String(body.rankingId || "");
  const profileId = String(body.profileId || "");
  const packageId = String(body.packageId || "");

  const ranking = await findRankingById(rankingId);
  const profile = await findProfileById(profileId);
  const pkg = findCreditPackage(packageId);

  if (!ranking || !profile || !pkg) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (ranking.isHidden || ranking.deletedAt) {
    return NextResponse.json(
      { error: "This Ranking is no longer available." },
      { status: 400 }
    );
  }

  const origin = request.nextUrl.origin;

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: pkg.priceCents,
          product_data: {
            name: `${pkg.label} — support ${profile.name}`,
            description: `Reputation Credits for ${profile.name} in "${ranking.title}"`,
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/rankings/${rankingId}?support=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/rankings/${rankingId}?support=cancelled&session_id={CHECKOUT_SESSION_ID}`,
    metadata: {
      userId: user.id,
      rankingId,
      profileId,
      packageId,
      credits: String(pkg.credits),
    },
  });

  await createPendingPayment({
    userId: user.id,
    rankingId,
    profileId,
    packageId: pkg.id,
    credits: pkg.credits,
    amountCents: pkg.priceCents,
    currency: "usd",
    stripeCheckoutSessionId: session.id,
  });

  return NextResponse.json({ url: session.url });
}
