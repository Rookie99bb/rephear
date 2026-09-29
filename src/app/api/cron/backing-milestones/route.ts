import { NextRequest, NextResponse } from "next/server";
import { runMilestoneDetection } from "@/lib/milestoneRunner";

// Phase 3 (§7, §14): milestone detection cron. Triggered by an external
// scheduler (same CRON_SECRET bearer pattern as /api/cron/digest) — not
// by user traffic. Core logic lives in src/lib/milestoneRunner.ts so
// the Phase 3 smoke test can exercise the exact same code path.
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

  const stats = await runMilestoneDetection();
  return NextResponse.json(stats);
}
