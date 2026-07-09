import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { findPaymentBySessionId, markPaymentStatus } from "@/db/payments";

// Best-effort bookkeeping when a user backs out of Stripe Checkout. Not
// security-critical (no credits are ever granted here) — it just keeps
// the payments table accurate instead of leaving abandoned sessions
// stuck in "pending" until Stripe's session finally expires.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await request.json();
  const payment = findPaymentBySessionId(String(sessionId || ""));
  if (payment && payment.userId === user.id) {
    markPaymentStatus(payment.id, "cancelled");
  }

  return NextResponse.json({ ok: true });
}
