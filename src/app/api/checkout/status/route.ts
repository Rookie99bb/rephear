import { NextRequest, NextResponse } from "next/server";
import { findPaymentBySessionId } from "@/db/payments";
import { findProfileById, getProfileStats } from "@/db/profiles";
import { getCurrentUser } from "@/lib/session";

// Polled by CheckoutBanner right after Stripe redirects back to
// /rankings/{id}?support=success&session_id=... — Credits are only
// actually granted once the Stripe webhook processes
// checkout.session.completed (async, not guaranteed to have happened by
// the time the browser lands back on the page), so the client polls
// this a few times until status flips to "completed" before firing the
// celebration dialog / card glow.
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

  const [profile, stats] = await Promise.all([
    findProfileById(payment.profileId),
    getProfileStats(payment.profileId),
  ]);

  return NextResponse.json({
    status: "completed",
    profileId: payment.profileId,
    profileName: profile?.name ?? "this profile",
    rankingId: payment.rankingId,
    credits: payment.credits,
    totalCredits: stats.totalReputationCredits,
  });
}
