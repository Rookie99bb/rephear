import { db } from "./client";
import { newId } from "@/lib/id";
import { authenticLikesClause } from "./visibility";

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

interface AllBoardRow extends BoardRow {
  ranking_id: string;
}

type SqlValue = string | number | bigint | boolean | null | Uint8Array;

async function getBoardRows(rankingId: string): Promise<BoardRow[]> {
  return (await db
    .prepare(
      `SELECT p.id AS profile_id,
              (SELECT COALESCE(SUM(l.count), 0) FROM likes l
                WHERE l.ranking_id = ? AND l.profile_id = p.id AND ${authenticLikesClause("l")}) AS like_count,
              (SELECT COALESCE(SUM(ct.credits), 0) FROM credit_transactions ct
                WHERE ct.ranking_id = ? AND ct.profile_id = p.id) AS reputation_credits,
              p.created_at AS added_at
       FROM profiles p
       WHERE p.ranking_id = ? AND p.deleted_at IS NULL`
    )
    .all(rankingId, rankingId, rankingId)) as unknown as BoardRow[];
}

// Cross-ranking variant: ONE statement for every ranking's board rows.
// On remote Turso each prepared statement is a network round-trip, so
// the snapshot cron reads the whole fleet here instead of once per
// ranking.
async function getAllBoardRows(): Promise<AllBoardRow[]> {
  return (await db
    .prepare(
      `SELECT p.ranking_id AS ranking_id,
              p.id AS profile_id,
              (SELECT COALESCE(SUM(l.count), 0) FROM likes l
                WHERE l.ranking_id = p.ranking_id AND l.profile_id = p.id AND ${authenticLikesClause("l")}) AS like_count,
              (SELECT COALESCE(SUM(ct.credits), 0) FROM credit_transactions ct
                WHERE ct.ranking_id = p.ranking_id AND ct.profile_id = p.id) AS reputation_credits,
              p.created_at AS added_at
       FROM profiles p
       WHERE p.deleted_at IS NULL`
    )
    .all()) as unknown as AllBoardRow[];
}

// Sort keys mirror getMostLoved / getMostSupported in
// src/db/leaderboards.ts exactly.
function sortBoards(rows: BoardRow[]): {
  board: SnapshotBoard;
  sorted: BoardRow[];
}[] {
  const loved = [...rows].sort(
    (a, b) => b.like_count - a.like_count || a.added_at.localeCompare(b.added_at)
  );
  const supported = [...rows].sort(
    (a, b) =>
      b.reputation_credits - a.reputation_credits ||
      a.added_at.localeCompare(b.added_at)
  );
  return [
    { board: "loved", sorted: loved },
    { board: "supported", sorted: supported },
  ];
}

function buildSnapshotTuples(
  rankingId: string,
  rows: BoardRow[],
  snapshotDate: string
): [string, string, string, SnapshotBoard, number, string][] {
  const tuples: [string, string, string, SnapshotBoard, number, string][] = [];
  for (const { board, sorted } of sortBoards(rows)) {
    for (let i = 0; i < sorted.length; i++) {
      tuples.push([
        newId(),
        rankingId,
        sorted[i].profile_id,
        board,
        i + 1,
        snapshotDate,
      ]);
    }
  }
  return tuples;
}

// Multi-row INSERT OR IGNORE, chunked so no single statement exceeds a
// safe parameter count on any SQLite/Turso build. Returns the number of
// rows actually inserted.
async function insertSnapshotTuplesChunked(
  tuples: [string, string, string, SnapshotBoard, number, string][]
): Promise<number> {
  const CHUNK = 250;
  let written = 0;
  for (let i = 0; i < tuples.length; i += CHUNK) {
    const chunk = tuples.slice(i, i + CHUNK);
    const values = chunk.map(() => "(?, ?, ?, ?, ?, ?)").join(",");
    const args: SqlValue[] = chunk.flatMap((t) => [
      t[0],
      t[1],
      t[2],
      t[3],
      t[4],
      t[5],
    ]);
    const result = await db
      .prepare(
        `INSERT OR IGNORE INTO ranking_snapshots
          (id, ranking_id, profile_id, board, rank, snapshot_date)
         VALUES ${values}`
      )
      .run(...args);
    written += result.changes;
  }
  return written;
}

// Writes today's snapshot for both boards. Safe to run multiple times a
// day — the UNIQUE key turns repeats into no-ops.
//
// Batched: one board-rows read + one chunked multi-row INSERT (two
// round-trips total for a typical ranking), not one INSERT per nominee —
// the per-row loop hung the cron on remote Turso, where every statement
// is a network round-trip.
export async function writeRankingSnapshot(
  rankingId: string,
  snapshotDate: string = todayUTC()
): Promise<{ rows: number }> {
  const rows = await getBoardRows(rankingId);
  const written = await insertSnapshotTuplesChunked(
    buildSnapshotTuples(rankingId, rows, snapshotDate)
  );
  return { rows: written };
}

// Fleet-wide snapshot writer for the daily cron: ONE board-rows read
// for every ranking, then a handful of chunked multi-row INSERTs.
// Per-ranking isolation is preserved — if a chunk fails, the rankings
// in that chunk are retried individually via writeRankingSnapshot and
// counted in errors, never silently dropped.
export async function writeAllRankingSnapshots(
  snapshotDate: string = todayUTC()
): Promise<{ rankings: number; rows: number; errors: number }> {
  const all = await getAllBoardRows();
  const byRanking = new Map<string, BoardRow[]>();
  for (const r of all) {
    const list = byRanking.get(r.ranking_id);
    if (list) list.push(r);
    else byRanking.set(r.ranking_id, [r]);
  }

  // Flatten per-ranking tuples into fleet-wide 250-row chunks,
  // remembering which rankings each chunk covers so a failing chunk
  // can fall back to per-ranking writes.
  const CHUNK = 250;
  const chunks: {
    tuples: [string, string, string, SnapshotBoard, number, string][];
    rankingIds: string[];
  }[] = [];
  let pending: [string, string, string, SnapshotBoard, number, string][] = [];
  let pendingRankings = new Set<string>();
  const flush = () => {
    if (pending.length > 0) {
      chunks.push({ tuples: pending, rankingIds: [...pendingRankings] });
      pending = [];
      pendingRankings = new Set<string>();
    }
  };
  for (const [rankingId, rows] of byRanking) {
    for (const t of buildSnapshotTuples(rankingId, rows, snapshotDate)) {
      pending.push(t);
      pendingRankings.add(rankingId);
      if (pending.length >= CHUNK) flush();
    }
  }
  flush();

  let rows = 0;
  let errors = 0;
  for (const chunk of chunks) {
    try {
      rows += await insertSnapshotTuplesChunked(chunk.tuples);
    } catch (err) {
      // Idempotent fallback: re-write the affected rankings the slow
      // way. The UNIQUE key makes the retry a no-op for rows the chunk
      // already wrote before failing.
      console.error(
        `[rankingSnapshots] chunk failed, falling back to per-ranking writes:`,
        err
      );
      for (const rankingId of chunk.rankingIds) {
        try {
          const r = await writeRankingSnapshot(rankingId, snapshotDate);
          rows += r.rows;
        } catch (err2) {
          errors++;
          console.error(
            `[rankingSnapshots] ranking ${rankingId} failed:`,
            err2
          );
        }
      }
    }
  }
  return { rankings: byRanking.size, rows, errors };
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
