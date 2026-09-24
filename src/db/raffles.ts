import { db } from "./client";
import { newId } from "@/lib/id";

export type RaffleStatus = "active" | "drawn" | "cancelled";

export interface Raffle {
  id: string;
  title: string;
  description: string;
  rankingId: string | null;
  prizeDescription: string;
  sponsorName: string;
  startsAt: string;
  endsAt: string;
  winnerCount: number;
  status: RaffleStatus;
  createdBy: string | null;
  createdAt: string;
}

export interface RaffleWinner {
  id: string;
  raffleId: string;
  userId: string;
  drawnAt: string;
  drawnBy: string | null;
}

interface RaffleRow {
  id: string;
  title: string;
  description: string;
  ranking_id: string | null;
  prize_description: string;
  sponsor_name: string;
  starts_at: string;
  ends_at: string;
  winner_count: number;
  status: RaffleStatus;
  created_by: string | null;
  created_at: string;
}

function toRaffle(row: RaffleRow): Raffle {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    rankingId: row.ranking_id,
    prizeDescription: row.prize_description,
    sponsorName: row.sponsor_name,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    winnerCount: row.winner_count,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function createRaffle(params: {
  title: string;
  description?: string;
  rankingId?: string | null;
  prizeDescription: string;
  sponsorName?: string;
  startsAt?: string;
  endsAt: string;
  winnerCount?: number;
  createdBy?: string | null;
}): Promise<Raffle> {
  const id = newId();
  await db
    .prepare(
      `INSERT INTO raffles
        (id, title, description, ranking_id, prize_description, sponsor_name,
         starts_at, ends_at, winner_count, created_by)
       VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?, ?, ?)`
    )
    .run(
      id,
      params.title,
      params.description ?? "",
      params.rankingId ?? null,
      params.prizeDescription,
      params.sponsorName ?? "",
      params.startsAt ?? null,
      params.endsAt,
      params.winnerCount ?? 1,
      params.createdBy ?? null
    );
  return (await findRaffleById(id))!;
}

export async function findRaffleById(id: string): Promise<Raffle | null> {
  const row = (await db
    .prepare("SELECT * FROM raffles WHERE id = ?")
    .get(id)) as unknown as RaffleRow | undefined;
  return row ? toRaffle(row) : null;
}

export async function listRaffles(): Promise<Raffle[]> {
  const rows = (await db
    .prepare("SELECT * FROM raffles ORDER BY created_at DESC")
    .all()) as unknown as RaffleRow[];
  return rows.map(toRaffle);
}

// Raffles currently accepting entries: status = 'active' and now is
// inside the [starts_at, ends_at] window. Scoped to one ranking, or
// site-wide (ranking_id IS NULL) which also applies.
export async function listActiveRafflesForRanking(
  rankingId: string
): Promise<Raffle[]> {
  const rows = (await db
    .prepare(
      `SELECT * FROM raffles
       WHERE status = 'active'
         AND datetime('now') >= datetime(starts_at)
         AND datetime('now') <= datetime(ends_at)
         AND (ranking_id = ? OR ranking_id IS NULL)
       ORDER BY created_at DESC`
    )
    .all(rankingId)) as unknown as RaffleRow[];
  return rows.map(toRaffle);
}

export async function countRaffleEntries(raffleId: string): Promise<number> {
  const row = (await db
    .prepare("SELECT COUNT(*) AS c FROM raffle_entries WHERE raffle_id = ?")
    .get(raffleId)) as unknown as { c: number };
  return row.c;
}

export async function hasRaffleEntry(
  raffleId: string,
  userId: string
): Promise<boolean> {
  const row = (await db
    .prepare(
      "SELECT id FROM raffle_entries WHERE raffle_id = ? AND user_id = ?"
    )
    .get(raffleId, userId)) as unknown as { id: string } | undefined;
  return !!row;
}

// Idempotent: a user gets at most one entry per raffle
// (UNIQUE(raffle_id, user_id)). Returns true if this call created the
// entry, false if the user was already entered.
export async function addRaffleEntry(params: {
  raffleId: string;
  userId: string;
  source?: string;
}): Promise<boolean> {
  if (await hasRaffleEntry(params.raffleId, params.userId)) return false;
  try {
    await db
      .prepare(
        `INSERT INTO raffle_entries (id, raffle_id, user_id, source)
         VALUES (?, ?, ?, ?)`
      )
      .run(newId(), params.raffleId, params.userId, params.source ?? "like");
    return true;
  } catch {
    // Race: another request inserted the same (raffle_id, user_id) first.
    // UNIQUE constraint did its job — treat as "already entered".
    return false;
  }
}

// Draws up to winnerCount random winners from the entries. The draw is
// only valid on an 'active' raffle whose end time has passed; it flips
// the raffle to 'drawn' in the same step so a draw can never run twice.
// Uses SQLite's RANDOM() ordering — the drawn_seed note records the
// mechanism for auditability (see also the raffle_drawn audit log entry,
// which the caller writes with the winner list).
export async function drawRaffleWinners(
  raffleId: string,
  drawnBy: string
): Promise<RaffleWinner[]> {
  const raffle = await findRaffleById(raffleId);
  if (!raffle) throw new Error("Raffle not found.");
  if (raffle.status !== "active") throw new Error("Raffle is not active.");
  if (new Date(raffle.endsAt).getTime() > Date.now()) {
    throw new Error("Raffle has not ended yet.");
  }

  const entryRows = (await db
    .prepare(
      `SELECT user_id FROM raffle_entries
       WHERE raffle_id = ?
       ORDER BY RANDOM()
       LIMIT ?`
    )
    .all(raffleId, raffle.winnerCount)) as unknown as { user_id: string }[];

  const winners: RaffleWinner[] = [];
  const seedNote = `sqlite RANDOM() over ${await countRaffleEntries(
    raffleId
  )} entries at ${new Date().toISOString()}`;
  for (const entry of entryRows) {
    const id = newId();
    await db
      .prepare(
        `INSERT INTO raffle_winners
          (id, raffle_id, user_id, drawn_by, drawn_seed)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, raffleId, entry.user_id, drawnBy, seedNote);
    winners.push({
      id,
      raffleId,
      userId: entry.user_id,
      drawnAt: new Date().toISOString(),
      drawnBy,
    });
  }

  await db
    .prepare("UPDATE raffles SET status = 'drawn' WHERE id = ? AND status = 'active'")
    .run(raffleId);

  return winners;
}

export async function cancelRaffle(raffleId: string): Promise<void> {
  await db
    .prepare("UPDATE raffles SET status = 'cancelled' WHERE id = ? AND status = 'active'")
    .run(raffleId);
}

export async function listRaffleWinners(
  raffleId: string
): Promise<RaffleWinner[]> {
  const rows = (await db
    .prepare("SELECT * FROM raffle_winners WHERE raffle_id = ? ORDER BY drawn_at ASC")
    .all(raffleId)) as unknown as {
    id: string;
    raffle_id: string;
    user_id: string;
    drawn_at: string;
    drawn_by: string | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    raffleId: r.raffle_id,
    userId: r.user_id,
    drawnAt: r.drawn_at,
    drawnBy: r.drawn_by,
  }));
}
