import { db } from "./client";
import { newId } from "@/lib/id";

// Phase 3 (§23/§26): daily rank snapshots. The snapshot job
// (src/app/api/cron/ranking-snapshots) writes one row per
// (ranking, nominee, board, day); the UNIQUE key makes re-runs and
// overlapping schedules idempotent. Movement arrows and momentum copy
// on ranking pages are derived ONLY from these snapshots — no
// "rising" label without velocity evidence, ever.

export type SnapshotBoard = "loved" | "supported";

export interface Movement {
  direction: "up" | "down" | "same" | "new";
  delta: number; // positions gained (positive) or lost (negative); 0 for same/new
  previousRank: number | null;
  currentRank: number;
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

interface BoardRow {
  profile_id: string;
  like_count: number;
  reputation_credits: number;
  added_at: string;
}

async function getBoardRows(rankingId: string): Promise<BoardRow[]> {
  return (await db
    .prepare(
      `SELECT p.id AS profile_id,
              (SELECT COALESCE(SUM(l.count), 0) FROM likes l
                WHERE l.ranking_id = ? AND l.profile_id = p.id) AS like_count,
              (SELECT COALESCE(SUM(ct.credits), 0) FROM credit_transactions ct
                WHERE ct.ranking_id = ? AND ct.profile_id = p.id) AS reputation_credits,
              p.created_at AS added_at
       FROM profiles p
       WHERE p.ranking_id = ? AND p.deleted_at IS NULL`
    )
    .all(rankingId, rankingId, rankingId)) as unknown as BoardRow[];
}

// Writes today's snapshot for both boards. Safe to run multiple times a
// day — the UNIQUE key turns repeats into no-ops.
export async function writeRankingSnapshot(
  rankingId: string,
  snapshotDate: string = todayUTC()
): Promise<{ rows: number }> {
  const rows = await getBoardRows(rankingId);
  const loved = [...rows].sort(
    (a, b) => b.like_count - a.like_count || a.added_at.localeCompare(b.added_at)
  );
  const supported = [...rows].sort(
    (a, b) =>
      b.reputation_credits - a.reputation_credits ||
      a.added_at.localeCompare(b.added_at)
  );
  // Sort keys mirror getMostLoved / getMostSupported in
  // src/db/leaderboards.ts exactly.
  let written = 0;
  const boards: { board: SnapshotBoard; sorted: BoardRow[] }[] = [
    { board: "loved", sorted: loved },
    { board: "supported", sorted: supported },
  ];
  for (const { board, sorted } of boards) {
    for (let i = 0; i < sorted.length; i++) {
      const result = await db
        .prepare(
          `INSERT OR IGNORE INTO ranking_snapshots
            (id, ranking_id, profile_id, board, rank, snapshot_date)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(newId(), rankingId, sorted[i].profile_id, board, i + 1, snapshotDate);
      written += result.changes;
    }
  }
  return { rows: written };
}

export async function getLatestSnapshotDate(
  rankingId: string
): Promise<string | null> {
  const row = (await db
    .prepare(
      `SELECT MAX(snapshot_date) AS d FROM ranking_snapshots WHERE ranking_id = ?`
    )
    .get(rankingId)) as unknown as { d: string | null } | undefined;
  return row?.d ?? null;
}

// Movement per nominee on a board: latest snapshot vs the one before it.
// Returns an empty map when fewer than two snapshots exist (no data, no
// arrows — never infer movement from a single data point).
export async function getMovement(
  rankingId: string,
  board: SnapshotBoard
): Promise<Map<string, Movement>> {
  const dates = (await db
    .prepare(
      `SELECT DISTINCT snapshot_date AS d FROM ranking_snapshots
       WHERE ranking_id = ? AND board = ?
       ORDER BY d DESC LIMIT 2`
    )
    .all(rankingId, board)) as unknown as { d: string }[];
  const out = new Map<string, Movement>();
  if (dates.length < 2) return out;
  const [latest, previous] = [dates[0].d, dates[1].d];
  const rows = (await db
    .prepare(
      `SELECT profile_id,
              MAX(CASE WHEN snapshot_date = ? THEN rank END) AS cur_rank,
              MAX(CASE WHEN snapshot_date = ? THEN rank END) AS prev_rank
       FROM ranking_snapshots
       WHERE ranking_id = ? AND board = ? AND snapshot_date IN (?, ?)
       GROUP BY profile_id`
    )
    .all(latest, previous, rankingId, board, latest, previous)) as unknown as {
    profile_id: string;
    cur_rank: number;
    prev_rank: number | null;
  }[];
  for (const r of rows) {
    if (r.prev_rank === null) {
      out.set(r.profile_id, {
        direction: "new",
        delta: 0,
        previousRank: null,
        currentRank: r.cur_rank,
      });
    } else if (r.prev_rank === r.cur_rank) {
      out.set(r.profile_id, {
        direction: "same",
        delta: 0,
        previousRank: r.prev_rank,
        currentRank: r.cur_rank,
      });
    } else {
      // delta is the magnitude (always >= 0); direction carries the sign.
      const delta = Math.abs(r.prev_rank - r.cur_rank);
      out.set(r.profile_id, {
        direction: r.prev_rank > r.cur_rank ? "up" : "down",
        delta,
        previousRank: r.prev_rank,
        currentRank: r.cur_rank,
      });
    }
  }
  return out;
}
