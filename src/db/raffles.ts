import { db } from "./client";
import { newId } from "@/lib/id";
import { overlappingWeeklyRaffleIds } from "@/lib/raffleSchedule";

export type RaffleStatus = "active" | "drawing" | "drawn" | "cancelled";

export interface Raffle {
  id: string;
  title: string;
  description: string;
  rankingId: string | null;
  prizeDescription: string;
  sponsorName: string;
  campaignKey: string;
  eligibilityType: "manual" | "event_streak";
  eventId: string | null;
  minStreak: number;
  maxReimbursementPence: number;
  startsAt: string;
  endsAt: string;
  drawAt: string;
  resultsEmailSentAt: string | null;
  outcomeEmailSentAt: string | null;
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
  campaign_key: string;
  eligibility_type: "manual" | "event_streak";
  event_id: string | null;
  min_streak: number;
  max_reimbursement_pence: number;
  starts_at: string;
  ends_at: string;
  draw_at: string | null;
  results_email_sent_at: string | null;
  outcome_email_sent_at: string | null;
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
    campaignKey: row.campaign_key ?? "",
    eligibilityType: row.eligibility_type ?? "manual",
    eventId: row.event_id ?? null,
    minStreak: Number(row.min_streak ?? 0),
    maxReimbursementPence: Number(row.max_reimbursement_pence ?? 0),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    drawAt: row.draw_at ?? row.ends_at,
    resultsEmailSentAt: row.results_email_sent_at,
    outcomeEmailSentAt: row.outcome_email_sent_at,
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
  campaignKey?: string;
  eligibilityType?: "manual" | "event_streak";
  eventId?: string | null;
  minStreak?: number;
  maxReimbursementPence?: number;
  startsAt?: string;
  endsAt: string;
  drawAt?: string;
  rankingIds?: string[];
  winnerCount?: number;
  createdBy?: string | null;
}): Promise<Raffle> {
  const id = newId();
  await db
    .prepare(
      `INSERT INTO raffles
        (id, title, description, ranking_id, prize_description, sponsor_name,
         campaign_key, eligibility_type, event_id, min_streak, max_reimbursement_pence,
         starts_at, ends_at, draw_at, winner_count, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?, ?, ?, ?)`
    )
    .run(
      id,
      params.title,
      params.description ?? "",
      params.rankingId ?? null,
      params.prizeDescription,
      params.sponsorName ?? "",
      params.campaignKey ?? "",
      params.eligibilityType ?? "manual",
      params.eventId ?? null,
      params.minStreak ?? 0,
      params.maxReimbursementPence ?? 0,
      params.startsAt ?? null,
      params.endsAt,
      params.drawAt ?? params.endsAt,
      params.winnerCount ?? 1,
      params.createdBy ?? null
    );
  for (const rankingId of new Set(params.rankingIds ?? [])) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO raffle_rankings (raffle_id, ranking_id)
         VALUES (?, ?)`
      )
      .run(id, rankingId);
  }
  return (await findRaffleById(id))!;
}

export interface RaffleRankingResult {
  rankingId: string;
  title: string;
  finalPosition: number | null;
  finalScore: number | null;
}

export async function listRaffleRankingResults(
  raffleId: string
): Promise<RaffleRankingResult[]> {
  const rows = (await db
    .prepare(
      `SELECT rr.ranking_id, r.title, rr.final_position, rr.final_score
       FROM raffle_rankings rr
       JOIN rankings r ON r.id = rr.ranking_id
       WHERE rr.raffle_id = ?
       ORDER BY COALESCE(rr.final_position, 999), r.title`
    )
    .all(raffleId)) as unknown as {
    ranking_id: string;
    title: string;
    final_position: number | null;
    final_score: number | null;
  }[];
  return rows.map((row) => ({
    rankingId: row.ranking_id,
    title: row.title,
    finalPosition: row.final_position,
    finalScore: row.final_score,
  }));
}

// Freezes the campaign's Top 3 rankings using organic vote totals at the
// voting deadline. Repeated calls are idempotent and never rewrite a result.
export async function finalizeRaffleResults(raffleId: string): Promise<void> {
  const existing = (await db
    .prepare(
      `SELECT COUNT(*) AS c FROM raffle_rankings
       WHERE raffle_id = ? AND final_position IS NOT NULL`
    )
    .get(raffleId)) as unknown as { c: number };
  if (existing.c > 0) return;

  const rows = (await db
    .prepare(
      `SELECT rr.ranking_id,
              COALESCE(SUM(CASE WHEN l.like_source = 'organic' THEN l.count ELSE 0 END), 0) AS score
       FROM raffle_rankings rr
       LEFT JOIN likes l ON l.ranking_id = rr.ranking_id
       WHERE rr.raffle_id = ?
       GROUP BY rr.ranking_id
       ORDER BY score DESC, rr.ranking_id ASC`
    )
    .all(raffleId)) as unknown as { ranking_id: string; score: number }[];

  for (let index = 0; index < rows.length; index++) {
    await db
      .prepare(
        `UPDATE raffle_rankings
         SET final_position = ?, final_score = ?
         WHERE raffle_id = ? AND ranking_id = ?`
      )
      .run(index + 1, rows[index].score, raffleId, rows[index].ranking_id);
  }
}

export async function isUserEligibleForRaffle(
  raffleId: string,
  userId: string
): Promise<boolean> {
  const raffle = await findRaffleById(raffleId);
  if (!raffle) return false;
  if (raffle.eligibilityType === "event_streak") {
    if (!raffle.eventId || raffle.minStreak < 1) return false;
    const drawDate = londonDate(raffle.drawAt);
    const row = await db.prepare(`
      SELECT 1 AS eligible
      FROM event_people ep
      JOIN backer_checkins bc ON bc.user_id=ep.user_id
      WHERE ep.event_id=? AND ep.user_id=? AND ep.is_hidden=0
        AND bc.checkin_date=? AND bc.current_streak>=?
        AND NOT EXISTS (
          SELECT 1 FROM raffle_winners rw
          JOIN raffles previous ON previous.id=rw.raffle_id
          WHERE previous.campaign_key=? AND rw.user_id=ep.user_id
        )
      LIMIT 1`).get<{ eligible: number }>(
        raffle.eventId, userId, drawDate, raffle.minStreak, raffle.campaignKey
      );
    return !!row;
  }
  const row = (await db
    .prepare(
      `SELECT 1 AS eligible
       FROM likes l
       JOIN raffle_rankings rr
         ON rr.raffle_id = ?
        AND rr.ranking_id = l.ranking_id
        AND rr.final_position BETWEEN 1 AND 3
       WHERE l.user_id = ?
         AND l.like_source = 'organic'
         AND datetime(l.created_at) <= datetime(?)
       LIMIT 1`
    )
    .get(raffleId, userId, raffle.startsAt)) as unknown as
    | { eligible: number }
    | undefined;
  return !!row;
}

function londonDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export async function countEligibleRaffleParticipants(raffleId: string): Promise<number> {
  const raffle = await findRaffleById(raffleId);
  if (!raffle) return 0;
  if (raffle.eligibilityType !== "event_streak" || !raffle.eventId) {
    return countRaffleEntries(raffleId);
  }
  const row = await db.prepare(`
    SELECT COUNT(DISTINCT ep.user_id) AS c
    FROM event_people ep
    JOIN backer_checkins bc ON bc.user_id=ep.user_id
    WHERE ep.event_id=? AND ep.user_id IS NOT NULL AND ep.is_hidden=0
      AND bc.checkin_date=? AND bc.current_streak>=?
      AND NOT EXISTS (
        SELECT 1 FROM raffle_winners rw
        JOIN raffles previous ON previous.id=rw.raffle_id
        WHERE previous.campaign_key=? AND rw.user_id=ep.user_id
      )`).get<{ c: number }>(raffle.eventId, londonDate(raffle.drawAt), raffle.minStreak, raffle.campaignKey);
  return Number(row?.c ?? 0);
}

async function materializeEligibleEntries(raffle: Raffle): Promise<void> {
  if (raffle.eligibilityType !== "event_streak" || !raffle.eventId) return;
  await db.prepare(`
    INSERT OR IGNORE INTO raffle_entries (id,raffle_id,user_id,source)
    SELECT lower(hex(randomblob(16))), ?, ep.user_id, 'event_streak_auto'
    FROM event_people ep
    JOIN backer_checkins bc ON bc.user_id=ep.user_id
    WHERE ep.event_id=? AND ep.user_id IS NOT NULL AND ep.is_hidden=0
      AND bc.checkin_date=? AND bc.current_streak>=?
      AND NOT EXISTS (
        SELECT 1 FROM raffle_winners rw
        JOIN raffles previous ON previous.id=rw.raffle_id
        WHERE previous.campaign_key=? AND rw.user_id=ep.user_id
      )
    GROUP BY ep.user_id`).run(
      raffle.id, raffle.eventId, londonDate(raffle.drawAt), raffle.minStreak, raffle.campaignKey
    );
}

export async function checkInToRaffle(params: {
  raffleId: string;
  userId: string;
}): Promise<"entered" | "already_entered"> {
  const raffle = await findRaffleById(params.raffleId);
  if (!raffle || raffle.status !== "active") throw new Error("Draw unavailable.");
  const now = Date.now();
  if (now < new Date(raffle.startsAt).getTime()) {
    throw new Error("Draw Check-in has not opened yet.");
  }
  if (now >= new Date(raffle.endsAt).getTime()) {
    throw new Error("Draw Check-in has closed.");
  }
  if (!(await isUserEligibleForRaffle(params.raffleId, params.userId))) {
    throw new Error(
      "You are not eligible for this draw. Only Backers who voted for a final Top 3 ranking may check in."
    );
  }
  const created = await addRaffleEntry({
    raffleId: params.raffleId,
    userId: params.userId,
    source: "qualified_check_in",
  });
  return created ? "entered" : "already_entered";
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
         AND eligibility_type = 'manual'
         AND datetime('now') >= datetime(starts_at)
         AND datetime('now') <= datetime(ends_at)
         AND (ranking_id = ? OR ranking_id IS NULL)
       ORDER BY created_at DESC`
    )
    .all(rankingId)) as unknown as RaffleRow[];
  return rows.map(toRaffle);
}

export async function isRankingVotingClosedForDraw(
  rankingId: string
): Promise<boolean> {
  const row = (await db
    .prepare(
      `SELECT 1 AS closed
       FROM raffle_rankings rr
       JOIN raffles ra ON ra.id = rr.raffle_id
       WHERE rr.ranking_id = ?
         AND ra.status = 'active'
         AND datetime('now') >= datetime(ra.starts_at)
       LIMIT 1`
    )
    .get(rankingId)) as unknown as { closed: number } | undefined;
  return !!row;
}

// Legacy site-wide draw reader, retained for older admin-created records.
export async function listActiveSitewideRaffles(): Promise<Raffle[]> {
  const rows = (await db
    .prepare(
      `SELECT * FROM raffles
       WHERE status = 'active'
         AND datetime('now') >= datetime(starts_at)
         AND datetime('now') <= datetime(ends_at)
         AND ranking_id IS NULL
       ORDER BY created_at DESC`
    )
    .all()) as unknown as RaffleRow[];
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
      .run(newId(), params.raffleId, params.userId, params.source ?? "qualified_check_in");
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
  drawnBy: string | null
): Promise<RaffleWinner[]> {
  const raffle = await findRaffleById(raffleId);
  if (!raffle) throw new Error("Raffle not found.");
  if (raffle.status !== "active") throw new Error("Raffle is not active.");
  if (new Date(raffle.drawAt).getTime() > Date.now()) {
    throw new Error("The scheduled draw time has not arrived yet.");
  }

  await materializeEligibleEntries(raffle);

  const claimed = await db
    .prepare("UPDATE raffles SET status = 'drawing' WHERE id = ? AND status = 'active'")
    .run(raffleId);
  if (claimed.changes !== 1) throw new Error("This draw is already being processed.");

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
    .prepare("UPDATE raffles SET status = 'drawn' WHERE id = ? AND status = 'drawing'")
    .run(raffleId);

  return winners;
}

export async function listRafflesReadyForResults(): Promise<Raffle[]> {
  const rows = (await db
    .prepare(
      `SELECT * FROM raffles
       WHERE status = 'active'
         AND eligibility_type = 'manual'
         AND datetime('now') >= datetime(starts_at)
         AND results_email_sent_at IS NULL
       ORDER BY starts_at ASC`
    )
    .all()) as unknown as RaffleRow[];
  return rows.map(toRaffle);
}

// Special campaigns own their whole activity window. Cancel overlapping
// weekly draws before the cron can notify entrants or select a winner.
export async function cancelWeeklyRafflesOverlappingSpecials(): Promise<string[]> {
  const ids = overlappingWeeklyRaffleIds(await listRaffles());
  for (const id of ids) await cancelRaffle(id);
  return ids;
}

export async function listRafflesReadyToDraw(): Promise<Raffle[]> {
  const rows = (await db
    .prepare(
      `SELECT * FROM raffles
       WHERE status = 'active'
         AND datetime('now') >= datetime(COALESCE(draw_at, ends_at))
       ORDER BY COALESCE(draw_at, ends_at) ASC`
    )
    .all()) as unknown as RaffleRow[];
  return rows.map(toRaffle);
}

export async function markRaffleResultsEmailSent(
  raffleId: string,
  sentAt: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE raffles SET results_email_sent_at = ?
       WHERE id = ? AND results_email_sent_at IS NULL`
    )
    .run(sentAt, raffleId);
}

export async function listRaffleParticipantEmails(
  raffleId: string
): Promise<{ userId: string; email: string }[]> {
  const rows = (await db
    .prepare(
      `SELECT DISTINCT u.id AS user_id, u.email
       FROM users u
       JOIN likes l ON l.user_id = u.id AND l.like_source = 'organic'
       JOIN raffle_rankings rr
         ON rr.raffle_id = ? AND rr.ranking_id = l.ranking_id
       JOIN raffles ra ON ra.id = rr.raffle_id
       WHERE datetime(l.created_at) <= datetime(ra.starts_at)
       ORDER BY u.id`
    )
    .all(raffleId)) as unknown as { user_id: string; email: string }[];
  return rows.map((row) => ({ userId: row.user_id, email: row.email }));
}

// Only the final Top 3's genuine voters receive the 24-hour notice. Merely
// receiving this message does not create an entry: the Backer must still
// complete Draw Check-in before the published deadline.
export async function listEligibleRaffleEmails(
  raffleId: string
): Promise<{ userId: string; email: string }[]> {
  const rows = (await db.prepare(`
    SELECT DISTINCT u.id AS user_id, u.email
    FROM users u
    JOIN likes l ON l.user_id=u.id AND l.like_source='organic'
    JOIN raffle_rankings rr ON rr.raffle_id=? AND rr.ranking_id=l.ranking_id
      AND rr.final_position BETWEEN 1 AND 3
    JOIN raffles ra ON ra.id=rr.raffle_id
    WHERE datetime(l.created_at)<=datetime(ra.starts_at)
      AND TRIM(u.email)!='' AND u.id NOT LIKE 'seed\_%' ESCAPE '\\'
    ORDER BY u.id`).all(raffleId)) as unknown as { user_id: string; email: string }[];
  return rows.map((row) => ({ userId: row.user_id, email: row.email }));
}

export async function listAllBackerEmails(): Promise<{ userId: string; email: string }[]> {
  const rows = (await db.prepare(`
    SELECT id AS user_id,email FROM users
    WHERE TRIM(email)!='' AND id NOT LIKE 'seed\_%' ESCAPE '\\'
    ORDER BY id`).all()) as unknown as { user_id: string; email: string }[];
  return rows.map((row) => ({ userId: row.user_id, email: row.email }));
}

export async function listRafflesReadyForOutcomeEmail(): Promise<Raffle[]> {
  const rows = (await db.prepare(`
    SELECT * FROM raffles
    WHERE status='drawn' AND eligibility_type='manual'
      AND outcome_email_sent_at IS NULL
    ORDER BY draw_at ASC`).all()) as unknown as RaffleRow[];
  return rows.map(toRaffle);
}

export async function markRaffleOutcomeEmailSent(raffleId: string, sentAt: string): Promise<void> {
  await db.prepare(`UPDATE raffles SET outcome_email_sent_at=?
    WHERE id=? AND outcome_email_sent_at IS NULL`).run(sentAt, raffleId);
}

export async function recordRaffleEmailDelivery(params: {
  raffleId: string;
  userId: string;
  emailType: "eligibility" | "outcome";
  emailAddress: string;
  sent: boolean;
  failureReason?: string;
}): Promise<void> {
  await db.prepare(`INSERT OR IGNORE INTO raffle_email_deliveries
    (id,raffle_id,user_id,email_type,email_address,status,failure_reason)
    VALUES (?,?,?,?,?,?,?)`).run(
      newId(), params.raffleId, params.userId, params.emailType,
      params.emailAddress, params.sent ? "sent" : "failed", params.failureReason ?? ""
    );
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
