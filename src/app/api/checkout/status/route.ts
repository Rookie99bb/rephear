import { NextRequest, NextResponse } from "next/server";
import { findPaymentBySessionId } from "@/db/payments";
import { findProfileById, getProfileStats } from "@/db/profiles";
import { getSupportedRankSnapshot } from "@/db/leaderboards";
import { getConvictionRecord } from "@/db/convictionRecords";
import { getCurrentUser } from "@/lib/session";

// Polled by CheckoutBanner right after Stripe redirects back to
// /rankings/{id}?support=success&session_id=... — Credits are only
// actually granted once the Stripe webhook processes
// checkout.session.completed (async, not guaranteed to have happened by
// the time the browser lands back on the page), so the client polls
// this a few times until status flips to "completed" before firing the
// celebration dialog / card glow.
//
// Phase 1 (v2 redesign): on completion this also returns the data for
// the §15 four-part post-support experience, ALL computed from real
// data — nothing is hardcoded or fabricated:
//  - amountCents/currency: what the supporter actually paid
//  - visibility: the choice they made at checkout
//  - rankBefore: the nominee's Most-Supported rank BEFORE this payment
//    (from conviction_records, captured pre-payment by the webhook)
//  - rankAfter: the live rank NOW (after the credits landed)
//  - isFirstSupport: whether this payment created the conviction record
//  - supporterNumber: Nth supporter (only meaningful on first support)
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  const payment = await findPaymentBySessionId(sessionId);
  // Scoped to the requesting user's own payment — never leak someone
  // else's Checkout Session status/profile/credits by guessing an id.
  if (!payment || payment.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (payment.status !== "completed") {
    return NextResponse.json({ status: payment.status });
  }

  const [profile, stats, snapshot, conviction] = await Promise.all([
    findProfileById(payment.profileId),
    getProfileStats(payment.profileId),
    getSupportedRankSnapshot(payment.rankingId, payment.profileId),
    getConvictionRecord(payment.userId, payment.rankingId, payment.profileId),
  ]);

  const isFirstSupport =
    conviction !== null && conviction.firstPaymentId === payment.id;

  return NextResponse.json({
    status: "completed",
    profileId: payment.profileId,
    profileName: profile?.name ?? "this profile",
    rankingId: payment.rankingId,
    credits: payment.credits,
    totalCredits: stats.totalReputationCredits,
    amountCents: payment.amountCents,
    currency: payment.currency,
    visibility: payment.visibilityChoice,
    rankBefore: conviction?.rankAtFirstSupport ?? null,
    rankAfter: snapshot?.rank ?? null,
    isFirstSupport,
    supporterNumber:
      isFirstSupport && conviction?.supporterCountAtFirstSupport != null
        ? conviction.supporterCountAtFirstSupport + 1
        : null,
  });
}
