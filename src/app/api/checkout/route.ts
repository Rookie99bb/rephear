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
  isSupportCurrency,
  creditsPerUnit,
  CUSTOM_AMOUNT_MIN_UNITS,
  CUSTOM_AMOUNT_MAX_UNITS,
  type SupportCurrency,
} from "@/lib/creditPackages";
import { findRankingById } from "@/db/rankings";
import { findProfileById } from "@/db/profiles";
import { findUserById } from "@/db/users";
import { createPendingPayment } from "@/db/payments";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { isVisibility, type Visibility } from "@/db/visibility";
import {
  isSupportReason,
  normalizeSupportReasonText,
} from "@/lib/supportReasons";

// Creates a real Stripe Checkout Session (test mode while STRIPE_SECRET_KEY
// is a test key) for purchasing Reputation Credits in support of one
// Nominee within one Ranking. The frontend never decides how many credits
// are granted — that comes from the server-side package config.
//
// Phase 1 (v2 redesign):
// - currency: 'usd' | 'gbp' (default 'usd'). Same unit economics in both
//   (£1 = 10 credits, no FX); Stripe charges in the chosen currency and
//   the payments row records it.
// - visibilityChoice: the supporter's "Show that I back X on my profile"
//   vs "Keep this Support private" choice, stored on the payments row NOW
//   (before payment completes) so the async Stripe webhook can persist it
//   onto the credit_transactions row without a race.
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
  const currency: SupportCurrency = isSupportCurrency(body.currency)
    ? body.currency
    : "usd";
  // Custom amount is a whole number of currency units, entered by the
  // supporter instead of picking one of the fixed packages — see
  // SupportPackages.tsx. Absent/undefined when a fixed package was
  // chosen instead. customAmountDollars is the legacy name (always USD).
  const customAmountRaw =
    body.customAmount ?? body.customAmountDollars ?? undefined;
  const legacyDollars = body.customAmountDollars !== undefined;

  const ranking = await findRankingById(rankingId);
  const profile = await findProfileById(profileId);

  if (!ranking || !profile) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Resolve exactly one of: a known fixed package, or a validated custom
  // amount, into the same {id, credits, priceCents, label} shape the rest
  // of this handler already works with — so nothing below this block
  // needs to know or care which path was taken. priceCents is in the
  // chosen currency's minor units (cents/pence).
  const perUnit = creditsPerUnit(currency);
  let pkg: { id: string; credits: number; priceCents: number; label: string } | undefined;
  if (packageId) {
    const found = findCreditPackage(packageId);
    if (found) {
      // Fixed packages are defined by their credit grant; the price in
      // the chosen currency follows the same unit rate (£1 = 10 credits,
      // exactly like $1 = 10) — so the USD priceCents values in
      // CREDIT_PACKAGES are reused for USD and recomputed for GBP.
      const priceCents =
        currency === "usd" ? found.priceCents : found.credits * 10;
      pkg = { ...found, priceCents };
    }
  } else if (customAmountRaw !== undefined && customAmountRaw !== null) {
    const units = Number(customAmountRaw);
    const min = legacyDollars ? CUSTOM_AMOUNT_MIN_DOLLARS : CUSTOM_AMOUNT_MIN_UNITS;
    const max = legacyDollars ? CUSTOM_AMOUNT_MAX_DOLLARS : CUSTOM_AMOUNT_MAX_UNITS;
    const unitWord = currency === "gbp" ? "pound" : "dollar";
    if (!Number.isInteger(units) || units < min || units > max) {
      return NextResponse.json(
        {
          error: `Enter a whole ${unitWord} amount between ${min} and ${max}.`,
        },
        { status: 400 }
      );
    }
    const credits = units * (legacyDollars ? CREDITS_PER_DOLLAR : perUnit);
    pkg = {
      id: CUSTOM_PACKAGE_ID,
      credits,
      priceCents: units * 100,
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

  // Visibility choice: explicit per-checkout choice wins; otherwise fall
  // back to the user's account default (Settings → Privacy).
  let visibilityChoice: Visibility = "public";
  if (isVisibility(body.visibilityChoice)) {
    visibilityChoice = body.visibilityChoice;
  } else {
    const fullUser = await findUserById(user.id);
    if (fullUser) visibilityChoice = fullUser.showSupports;
  }

  // Phase 5.1: optional "Why are you backing them?" reason. Preset key
  // validated against the allowlist (unknown keys are rejected, not
  // silently stored); free text is trimmed and capped at 280 chars and
  // never blocks checkout. Both ride the same pre-payment plumbing as
  // visibilityChoice so the webhook can snapshot them without a race.
  let supportReason: string | null = null;
  if (body.supportReason !== undefined && body.supportReason !== null) {
    if (!isSupportReason(body.supportReason)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    supportReason = body.supportReason;
  }
  const supportReasonText = normalizeSupportReasonText(body.supportReasonText);

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
          currency,
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
      currency,
      visibilityChoice,
      // Phase 5.1: reason backup in Stripe metadata (payments row is the
      // primary source; the webhook reads the payment row).
      supportReason: supportReason ?? "",
      supportReasonText: supportReasonText ?? "",
    },
  });

  await createPendingPayment({
    userId: user.id,
    rankingId,
    profileId,
    packageId: pkg.id,
    credits: pkg.credits,
    amountCents: pkg.priceCents,
    currency,
    visibilityChoice,
    supportReason,
    supportReasonText,
    stripeCheckoutSessionId: session.id,
  });

  return NextResponse.json({ url: session.url });
}
