import { NextRequest, NextResponse } from "next/server";
import { releaseMaturedCommissions } from "@/db/referrerCommissions";

// Triggered once a day by the same external scheduler as /api/cron/digest
// (Bearer CRON_SECRET) — not by user traffic. Flips referral commissions
// whose T+14 freeze has elapsed from 'pending' to 'available', skipping
// referrers who are paused or carry an open risk flag (those need a
// human decision first). Idempotent: re-running releases nothing new.
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

  const released = await releaseMaturedCommissions();
  return NextResponse.json({
    released: released.length,
    commissionIds: released.map((c) => c.id),
  });
}
