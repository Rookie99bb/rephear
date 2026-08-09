import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getStripeClient } from "@/lib/stripe";
import { getSiteUrl } from "@/lib/siteUrl";
import {
  findCreditPackage,
  CREDITS_PER_DOLLAR,
  CUSTOM_AMOUNT_MIN_DOLLARS,
  CUSTOM_AMOUNT_MAX_DOLLARS,
  CUSTOM_PACKAGE_ID,
} from "@/lib/creditPackages";
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
  // Custom amount is a whole number of US dollars, entered by the
  // supporter instead of picking one of the fixed packages below — see
  // SupportPackages.tsx. Absent/undefined when a fixed package was
  // chosen instead.
  const customAmountDollars = body.customAmountDollars;

  const ranking = await findRankingById(rankingId);
  const profile = await findProfileById(profileId);

  if (!ranking || !profile) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Resolve exactly one of: a known fixed package, or a validated custom
  // dollar amount, into the same {id, credits, priceCents, label} shape
  // the rest of this handler already works with — so nothing below this
  // block needs to know or care which path was taken.
  let pkg: { id: string; credits: number; priceCents: number; label: string } | undefined;
  if (packageId) {
    pkg = findCreditPackage(packageId);
  } else if (customAmountDollars !== undefined && customAmountDollars !== null) {
    const dollars = Number(customAmountDollars);
    if (
      !Number.isInteger(dollars) ||
      dollars < CUSTOM_AMOUNT_MIN_DOLLARS ||
      dollars > CUSTOM_AMOUNT_MAX_DOLLARS
    ) {
      return NextResponse.json(
        {
          error: `Enter a whole dollar amount between $${CUSTOM_AMOUNT_MIN_DOLLARS} and $${CUSTOM_AMOUNT_MAX_DOLLARS}.`,
        },
        { status: 400 }
      );
    }
    const credits = dollars * CREDITS_PER_DOLLAR;
    pkg = {
      id: CUSTOM_PACKAGE_ID,
      credits,
      priceCents: dollars * 100,
      label: `${credits.toLocaleString()} Reputation Credits`,
    };
  }

  if (!pkg) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (ranking.isHidden || ranking.deletedAt) {
    return NextResponse.json(
      { error: "This Ranking is no longer available." },
      { status: 400 }
    );
  }

  // Must be the app's real public origin, not request.nextUrl.origin —
  // behind Render's proxy that reflects the container's internal address
  // (localhost:<PORT>), which broke the post-payment redirect. See
  // src/lib/siteUrl.ts.
  const origin = getSiteUrl();

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
    // Without this, card statements fall back to a dynamic descriptor
    // built from the line item (the Nominee's name) instead of a fixed,
    // recognizable merchant name — confusing for cardholders and higher
    // chargeback risk.
    payment_intent_data: {
      statement_descriptor: "REPHEAR.COM",
    },
    metadata: {
      userId: user.id,
      rankingId,
      profileId,
      packageId: pkg.id,
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
