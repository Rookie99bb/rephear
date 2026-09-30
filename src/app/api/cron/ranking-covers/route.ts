import { NextRequest, NextResponse } from "next/server";
import { weeklyRankingCoverRefresh } from "@/db/rankingCoverRefresh";

// Weekly ranking cover refresh — every Monday 04:00 Europe/London.
// Triggered by the external scheduler (same CRON_SECRET Bearer <redacted>
// as /api/cron/ranking-snapshots and /api/cron/digest).
//
// Checks every eligible ranking's cover and replaces it only when
// something meaningful changed (top nominees changed, trending, stale
// cover, broken source). Manual/admin-locked covers are never touched.
// Every check is logged to ranking_cover_refresh_log.
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

  const result = await weeklyRankingCoverRefresh();
  return NextResponse.json(result);
}
