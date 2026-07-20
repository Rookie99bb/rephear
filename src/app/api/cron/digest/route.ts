import { NextRequest, NextResponse } from "next/server";
import { getDigestCandidates, markDigestSent } from "@/db/digest";
import { digestEmail } from "@/emails/digest";
import { sendEmail } from "@/lib/email";

// Triggered once a day by an external scheduler (a Cowork scheduled task
// hitting this URL, or a Render Cron Job once the Starter plan is
// active) — not by user traffic. Protected by a shared secret rather
// than a session, since the caller isn't a logged-in browser.
//
// Only sends to users who've actually Liked/Supported something AND
// have genuinely new activity since their last digest (see
// getDigestCandidates) — never a blanket daily email to everyone.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured on the server" },
      { status: 503 }
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const candidates = getDigestCandidates();
  const sentAt = new Date().toISOString();
  let sent = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const { subject, html } = digestEmail(candidate);
    const result = await sendEmail({ to: candidate.email, subject, html });
    if (result.sent) {
      sent++;
      markDigestSent(candidate.userId, sentAt);
    } else {
      failed++;
    }
  }

  return NextResponse.json({
    candidates: candidates.length,
    sent,
    failed,
  });
}
