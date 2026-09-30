import { db } from "./client";
import { newId } from "@/lib/id";
import { notSeedClause, activeUserClause } from "./visibility";

// Phase 3 (§7, §14, §23/§26): milestone_events — the factual event stream.
// Written ONLY by the milestone cron (src/app/api/cron/backing-milestones).
// Each threshold fires ONCE per (ranking, nominee), ever:
// UNIQUE(ranking_id, profile_id, type) + INSERT OR IGNORE. Later phases
// read these rows as the factual source for timelines (5.4),
// notifications (5.5) and share cards (5.6): no event row, no milestone
// rendered — nothing is ever inferred or fabricated.

export const MILESTONE_TYPES = [
  "nominated",
  "first_1k_credits",
  "backers_50",
  "entered_top_50",
  "entered_top_20",
  "entered_top_10",
  "credits_10k",
  "reached_3",
  "reached_1",
] as const;
export type MilestoneType = (typeof MILESTONE_TYPES)[number];

// Thresholds that grant Early Backer recognition, and the rank a
// supporter's FIRST backing moment must have been worse than to
// qualify (WHEN-based, never HOW MUCH). A NULL rank_at_support
// (unranked at support time) always qualifies — they were there before
// the nominee ranked at all.
export const EARLY_BACKER_THRESHOLDS: Record<string, number> = {
  entered_top_50: 50,
  entered_top_20: 20,
  entered_top_10: 10,
  reached_3: 3,
  reached_1: 1,
};

export interface MilestoneEvent {
  id: string;
  rankingId: string;
  profileId: string;
  type: MilestoneType;
  rankAtEvent: number | null;
  creditsAtEvent: number | null;
  backersAtEvent: number | null;
  createdAt: string;
}

interface MilestoneEventRow {
  id: string;
  ranking_id: string;
  profile_id: string;
  type: string;
  rank_at_event: number | null;
  credits_at_event: number | null;
  backers_at_event: number | null;
  created_at: string;
}

function toEvent(row: MilestoneEventRow): MilestoneEvent {
  return {
    id: row.id,
    rankingId: row.ranking_id,
    profileId: row.profile_id,
    type: row.type as MilestoneType,
    rankAtEvent: row.rank_at_event,
    creditsAtEvent: row.credits_at_event,
    backersAtEvent: row.backers_at_event,
    createdAt: row.created_at,
  };
}

// Records a threshold crossing. Returns { created: true } only when this
// call actually inserted the row — a cron re-run (or a concurrent run)
// hitting the same UNIQUE key is a no-op, so thresholds never fire
// twice and downstream awards/notifications stay idempotent.
export async function recordMilestoneEvent(params: {
  rankingId: string;
  profileId: string;
  type: MilestoneType;
  rankAtEvent: number | null;
  creditsAtEvent: number | null;
  backersAtEvent: number | null;
}): Promise<{ created: boolean; event: MilestoneEvent }> {
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO milestone_events
        (id, ranking_id, profile_id, type, rank_at_event, credits_at_event, backers_at_event)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      newId(),
      params.rankingId,
      params.profileId,
      params.type,
      params.rankAtEvent,
      params.creditsAtEvent,
      params.backersAtEvent
    );
  const row = (await db
    .prepare(
      `SELECT * FROM milestone_events
       WHERE ranking_id = ? AND profile_id = ? AND type = ?`
    )
    .get(params.rankingId, params.profileId, params.type)) as unknown as
    | MilestoneEventRow
    | undefined;
  return { created: result.changes > 0, event: toEvent(row!) };
}

export async function hasMilestoneEvent(
  rankingId: string,
  profileId: string,
  type: MilestoneType
): Promise<boolean> {
  const row = (await db
    .prepare(
      `SELECT id FROM milestone_events
       WHERE ranking_id = ? AND profile_id = ? AND type = ?`
    )
    .get(rankingId, profileId, type)) as unknown as { id: string } | undefined;
  return !!row;
}

export async function getMilestoneEvents(
  rankingId: string,
  profileId: string
): Promise<MilestoneEvent[]> {
  const rows = (await db
    .prepare(
      `SELECT * FROM milestone_events
       WHERE ranking_id = ? AND profile_id = ?
       ORDER BY created_at ASC`
    )
    .all(rankingId, profileId)) as unknown as MilestoneEventRow[];
  return rows.map(toEvent);
}

// ── Board snapshot for milestone detection ────────────────────────────
// One query per ranking: Most-Supported rank, total credits, distinct
// backer count (seed-excluded — same exclusion as the ranking totals).
// Ranking totals never filter visibility (Phase 1 invariant 1), and
// neither does milestone detection.
//
// Totals and ranks intentionally match the PUBLIC Most Supported board
// exactly (seed credits included in totals, same as getRankingStats):
// a milestone must describe the board users actually see, never a
// shadow board. Seed exclusion applies to ACCOUNTS, not board math —
// seed users are excluded from backer_count here and from awards
// (getFirstMoments), notifications, and follower lists elsewhere.

export interface NomineeBoardState {
  profileId: string;
  rank: number;
  totalCredits: number;
  backerCount: number;
}

export async function getSupportedBoardState(
  rankingId: string
): Promise<NomineeBoardState[]> {
  const rows = (await db
    .prepare(
      `SELECT p.id AS profile_id,
              COALESCE(SUM(ct.credits), 0) AS total_credits,
              COUNT(DISTINCT CASE WHEN ${notSeedClause("u")} AND ${activeUserClause("u")}
                                 THEN ct.supporter_user_id END) AS backer_count,
              p.created_at AS added_at
       FROM profiles p
       LEFT JOIN credit_transactions ct
         ON ct.profile_id = p.id AND ct.ranking_id = p.ranking_id
       LEFT JOIN users u ON u.id = ct.supporter_user_id
       WHERE p.ranking_id = ? AND p.deleted_at IS NULL
       GROUP BY p.id
       ORDER BY total_credits DESC, added_at ASC`
    )
    .all(rankingId)) as unknown as {
    profile_id: string;
    total_credits: number;
    backer_count: number;
  }[];
  return rows.map((row, index) => ({
    profileId: row.profile_id,
    rank: index + 1,
    totalCredits: row.total_credits,
    backerCount: row.backer_count,
  }));
}

// ── Batched cron primitives ─────────────────────────────────────────
// On remote Turso every prepared statement is a network round-trip.
// The milestone cron used to do thousands of sequential round-trips
// per run (one INSERT+SELECT per threshold candidate, one profile
// lookup per nominee, one notification-preflight per recipient) and
// hung in production. These batch variants collapse each per-ranking
// step to a constant handful of statements. Behavior (rows written,
// events fired, idempotency) is identical — only the access pattern
// changed.

type SqlValue = string | number | bigint | boolean | null | Uint8Array;

function chunked<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export interface MilestoneCandidate {
  profileId: string;
  type: MilestoneType;
  rankAtEvent: number | null;
  creditsAtEvent: number | null;
  backersAtEvent: number | null;
}

// Records many threshold crossings with chunked multi-row
// INSERT OR IGNORE ... RETURNING. Returns the set of
// `${profileId}|${type}` keys that were actually inserted — the
// batch equivalent of recordMilestoneEvent's { created } flag.
export async function recordMilestoneEventsBatch(
  rankingId: string,
  candidates: MilestoneCandidate[]
): Promise<Set<string>> {
  const created = new Set<string>();
  for (const chunk of chunked(candidates, 250)) {
    const values = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(",");
    const args: SqlValue[] = chunk.flatMap((c) => [
      newId(),
      rankingId,
      c.profileId,
      c.type,
      c.rankAtEvent,
      c.creditsAtEvent,
      c.backersAtEvent,
    ]);
    const rows = (await db
      .prepare(
        `INSERT OR IGNORE INTO milestone_events
          (id, ranking_id, profile_id, type, rank_at_event, credits_at_event, backers_at_event)
         VALUES ${values}
         RETURNING profile_id, type`
      )
      .all(...args)) as unknown as { profile_id: string; type: string }[];
    for (const r of rows) created.add(`${r.profile_id}|${r.type}`);
  }
  return created;
}

export interface RankingProfileBasic {
  id: string;
  name: string;
  claimStatus: string;
  claimedBy: string | null;
}

// One query for every nominee's display/claim basics in a ranking —
// replaces the per-nominee findProfileById calls in the cron.
export async function getRankingProfileBasics(
  rankingId: string
): Promise<Map<string, RankingProfileBasic>> {
  const rows = (await db
    .prepare(
      `SELECT id, name, claim_status, claimed_by
       FROM profiles
       WHERE ranking_id = ? AND deleted_at IS NULL`
    )
    .all(rankingId)) as unknown as {
    id: string;
    name: string;
    claim_status: string;
    claimed_by: string | null;
  }[];
  return new Map(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        name: r.name,
        claimStatus: r.claim_status,
        claimedBy: r.claimed_by,
      },
    ])
  );
}

export interface FirstMomentWithProfile extends FirstMoment {
  profileId: string;
}

// First backing moments for MANY nominees in one query — same filters
// as getFirstMoments (seed-excluded, hidden-excluded), just with an IN
// list instead of one profile_id.
export async function getFirstMomentsBatch(
  rankingId: string,
  profileIds: string[]
): Promise<FirstMomentWithProfile[]> {
  if (profileIds.length === 0) return [];
  const out: FirstMomentWithProfile[] = [];
  for (const chunk of chunked(profileIds, 500)) {
    const placeholders = chunk.map(() => "?").join(",");
    const rows = (await db
      .prepare(
        `SELECT bm.profile_id AS profile_id,
                bm.user_id AS user_id,
                bm.rank_at_support AS rank_at_support,
                bm.supported_at AS supported_at
         FROM backing_moments bm
         JOIN users u ON u.id = bm.user_id
         WHERE bm.ranking_id = ? AND bm.profile_id IN (${placeholders})
           AND bm.supported_at = (
             SELECT MIN(bm2.supported_at)
             FROM backing_moments bm2
             WHERE bm2.user_id = bm.user_id
               AND bm2.ranking_id = bm.ranking_id
               AND bm2.profile_id = bm.profile_id
           )
           AND ${notSeedClause("u")}
           AND ${activeUserClause("u")}`
      )
      .all(rankingId, ...chunk)) as unknown as {
      profile_id: string;
      user_id: string;
      rank_at_support: number | null;
      supported_at: string;
    }[];
    for (const r of rows) {
      out.push({
        profileId: r.profile_id,
        userId: r.user_id,
        rankAtSupport: r.rank_at_support,
        supportedAt: r.supported_at,
      });
    }
  }
  return out;
}

export interface EarlyBackerAwardItem {
  rankingId: string;
  profileId: string;
  milestoneType: string;
  userId: string;
}

// Awards many Early Backer rows with chunked multi-row INSERT OR
// IGNORE ... RETURNING. Returns the set of
// `${rankingId}|${profileId}|${milestoneType}|${userId}` keys actually
// inserted — the batch equivalent of awardEarlyBackers' per-user
// changes>0 check. Callers must pre-filter by the WHEN rule (first
// moment rank worse than the threshold, or unranked), exactly as
// awardEarlyBackers does.
export async function awardEarlyBackersBatch(
  items: EarlyBackerAwardItem[]
): Promise<Set<string>> {
  const created = new Set<string>();
  for (const chunk of chunked(items, 250)) {
    const values = chunk.map(() => "(?, ?, ?, ?, ?)").join(",");
    const args: SqlValue[] = chunk.flatMap((i) => [
      newId(),
      i.userId,
      i.rankingId,
      i.profileId,
      i.milestoneType,
    ]);
    const rows = (await db
      .prepare(
        `INSERT OR IGNORE INTO early_backer_awards
          (id, user_id, ranking_id, profile_id, milestone_type)
         VALUES ${values}
         RETURNING user_id, ranking_id, profile_id, milestone_type`
      )
      .all(...args)) as unknown as {
      user_id: string;
      ranking_id: string;
      profile_id: string;
      milestone_type: string;
    }[];
    for (const r of rows) {
      created.add(
        `${r.ranking_id}|${r.profile_id}|${r.milestone_type}|${r.user_id}`
      );
    }
  }
  return created;
}

// ── Early Backer awards (§7) ────────────────────────────────────────────
// Awarded by the milestone cron when an entry threshold fires. The
// recipient set: users whose FIRST backing moment for this
// (ranking, nominee) predates the crossing — proven by the immutable
// snapshot (rank_at_support worse than the threshold, or NULL /
// unranked). Basis = WHEN, never HOW MUCH: no wealth-based recognition,
// ever. Seed accounts and hidden users are excluded.
export interface EarlyBackerAward {
  id: string;
  userId: string;
  rankingId: string;
  profileId: string;
  milestoneType: string;
  awardedAt: string;
}

export interface FirstMoment {
  userId: string;
  rankAtSupport: number | null;
  supportedAt: string;
}

// First backing moment per user for a (ranking, nominee) — from the
// immutable Phase 5.1 snapshots, richer and more precise than
// conviction_records (which only stores the first-ever support).
export async function getFirstMoments(
  rankingId: string,
  profileId: string
): Promise<FirstMoment[]> {
  const rows = (await db
    .prepare(
      `SELECT bm.user_id AS user_id,
              bm.rank_at_support AS rank_at_support,
              bm.supported_at AS supported_at
       FROM backing_moments bm
       JOIN users u ON u.id = bm.user_id
       WHERE bm.ranking_id = ? AND bm.profile_id = ?
         AND bm.supported_at = (
           SELECT MIN(bm2.supported_at)
           FROM backing_moments bm2
           WHERE bm2.user_id = bm.user_id
             AND bm2.ranking_id = bm.ranking_id
             AND bm2.profile_id = bm.profile_id
         )
         AND ${notSeedClause("u")}
         AND ${activeUserClause("u")}`
    )
    .all(rankingId, profileId)) as unknown as {
    user_id: string;
    rank_at_support: number | null;
    supported_at: string;
  }[];
  return rows.map((r) => ({
    userId: r.user_id,
    rankAtSupport: r.rank_at_support,
    supportedAt: r.supported_at,
  }));
}

export async function awardEarlyBackers(params: {
  rankingId: string;
  profileId: string;
  milestoneType: keyof typeof EARLY_BACKER_THRESHOLDS;
}): Promise<string[]> {
  const threshold = EARLY_BACKER_THRESHOLDS[params.milestoneType];
  const firstMoments = await getFirstMoments(params.rankingId, params.profileId);

  const awarded: string[] = [];
  for (const m of firstMoments) {
    // They backed before the crossing iff the nominee ranked worse than
    // the threshold (or wasn't ranked at all) when they backed.
    if (m.rankAtSupport !== null && m.rankAtSupport <= threshold) continue;
    const result = await db
      .prepare(
        `INSERT OR IGNORE INTO early_backer_awards
          (id, user_id, ranking_id, profile_id, milestone_type)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        newId(),
        m.userId,
        params.rankingId,
        params.profileId,
        params.milestoneType
      );
    if (result.changes > 0) awarded.push(m.userId);
  }
  return awarded;
}

export async function getEarlyBackerAwards(
  userId: string
): Promise<EarlyBackerAward[]> {
  const rows = (await db
    .prepare(
      `SELECT id, user_id, ranking_id, profile_id, milestone_type, awarded_at
       FROM early_backer_awards
       WHERE user_id = ?
       ORDER BY awarded_at DESC`
    )
    .all(userId)) as unknown as {
    id: string;
    user_id: string;
    ranking_id: string;
    profile_id: string;
    milestone_type: string;
    awarded_at: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    rankingId: r.ranking_id,
    profileId: r.profile_id,
    milestoneType: r.milestone_type,
    awardedAt: r.awarded_at,
  }));
}

export async function hasEarlyBackerAward(
  userId: string,
  rankingId: string,
  profileId: string,
  milestoneType: string
): Promise<boolean> {
  const row = (await db
    .prepare(
      `SELECT id FROM early_backer_awards
       WHERE user_id = ? AND ranking_id = ? AND profile_id = ? AND milestone_type = ?`
    )
    .get(userId, rankingId, profileId, milestoneType)) as unknown as
    | { id: string }
    | undefined;
  return !!row;
}
