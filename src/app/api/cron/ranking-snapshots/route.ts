import { NextRequest, NextResponse } from "next/server";
import { writeAllRankingSnapshots } from "@/db/rankingSnapshots";

// Phase 3 (§23/§26): daily ranking snapshots. Triggered by an external
// scheduler (same CRON_SECRET bearer pattern as /api/cron/digest).
// Writes one row per (ranking, nominee, board, day); the UNIQUE key
// makes re-runs and overlapping schedules idempotent. Movement arrows
// on ranking pages derive from these snapshots — never from live
// rank alone.
//
// Fleet-wide batched writer (one board-rows read + chunked multi-row
// INSERTs): the old per-ranking × per-nominee INSERT loop did thousands
// of sequential round-trips and hung on remote Turso.
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

  const { rankings, rows, errors } = await writeAllRankingSnapshots();
  return NextResponse.json({ rankings, rows, errors });
}
