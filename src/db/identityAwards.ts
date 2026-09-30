import { db } from "./client";
import { newId } from "@/lib/id";
import { notSeedClause, activeUserClause } from "./visibility";
import {
  IDENTITY_ENGINE_VERSION,
  IDENTITY_KEYS,
  IDENTITY_RULES,
  isIdentityKey,
  talentSpotterSummary,
  underdogBackerSummary,
  loyalBackerSummary,
  identityEarnedTitle,
  identityEarnedBody,
  type IdentityKey,
  type IdentityRules,
} from "@/lib/identityConfig";
import { createNotification } from "./notifications";

// Phase 5.7 (evidence-based identity engine): identity_awards — one row
// per (user, identity) EVER. Awarded only from patterns over time,
// never from a single action, never from spend. UNIQUE key makes the
// engine idempotent: recomputing on the same data produces the same
// rows. Each row is versioned (engine_version) and carries the evidence
// window + the thresholds in force at award time, so old awards remain
// interpretable after thresholds are tuned.
//
// Table DDL lives in src/db/schema.ts (createIdentityAwardsTableIfMissing).
// Seed accounts never earn identities and never count in thresholds.

export interface IdentityAward {
  id: string;
  userId: string;
  identityKey: IdentityKey;
  engineVersion: string;
  evidenceWindow: { from: string; to: string };
  thresholds: unknown;
  evidenceSummary: string;
  displayOrder: number;
  awardedAt: string;
}

interface IdentityAwardRow {
  id: string;
  user_id: string;
  identity_key: string;
  engine_version: string;
  evidence_window: string;
  thresholds_json: string;
  evidence_summary: string;
  display_order: number;
  awarded_at: string;
}

function toAward(r: IdentityAwardRow): IdentityAward {
  return {
    id: r.id,
    userId: r.user_id,
    identityKey: r.identity_key as IdentityKey,
    engineVersion: r.engine_version,
    evidenceWindow: JSON.parse(r.evidence_window) as { from: string; to: string },
    thresholds: JSON.parse(r.thresholds_json) as unknown,
    evidenceSummary: r.evidence_summary,
    displayOrder: r.display_order,
    awardedAt: r.awarded_at,
  };
}

export async function getIdentityAwards(
  userId: string
): Promise<IdentityAward[]> {
  const rows = (await db
    .prepare(
      `SELECT * FROM identity_awards
       WHERE user_id = ?
       ORDER BY display_order ASC, awarded_at ASC`
    )
    .all(userId)) as unknown as IdentityAwardRow[];
  return rows.map(toAward);
}

export async function hasIdentityAward(
  userId: string,
  key: IdentityKey
): Promise<boolean> {
  const row = (await db
    .prepare(
      `SELECT 1 AS x FROM identity_awards WHERE user_id = ? AND identity_key = ?`
    )
    .get(userId, key)) as unknown as { x: number } | undefined;
  return !!row;
}

// ── Evidence computation (pure reads; 3 statements per user) ───────────

interface IdentityEvidence {
  key: IdentityKey;
  qualifies: boolean;
  evidenceSummary: string;
  window: { from: string; to: string };
}

async function talentSpotterEvidence(
  userId: string,
  rules: IdentityRules
): Promise<IdentityEvidence> {
  const cfg = rules.talent_spotter;
  const placeholders = cfg.milestoneTypes.map(() => "?").join(",");
  const row = (await db
    .prepare(
      `SELECT COUNT(*) AS awards,
              COUNT(DISTINCT profile_id) AS nominees,
              MIN(awarded_at) AS first_at
       FROM early_backer_awards
       WHERE user_id = ? AND milestone_type IN (${placeholders})`
    )
    .get(userId, ...cfg.milestoneTypes)) as unknown as {
    awards: number;
    nominees: number;
    first_at: string | null;
  };
  // early_backer_awards is written seed-excluded by the milestone cron
  // (Phase 3), so no seed clause is needed here.
  const qualifies =
    row.awards >= cfg.minAwards && row.nominees >= cfg.minDistinctNominees;
  return {
    key: "talent_spotter",
    qualifies,
    evidenceSummary: talentSpotterSummary(row.awards, row.nominees),
    window: { from: row.first_at ?? "", to: "" },
  };
}

async function underdogBackerEvidence(
  userId: string,
  rules: IdentityRules
): Promise<IdentityEvidence> {
  const cfg = rules.underdog_backer;
  const milestoneType = `entered_top_${cfg.enteredTopK}`;
  const row = (await db
    .prepare(
      `SELECT COUNT(*) AS moments,
              COUNT(DISTINCT bm.ranking_id || '|' || bm.profile_id) AS nominees,
              MIN(bm.supported_at) AS first_at
       FROM backing_moments bm
       JOIN users u ON u.id = bm.user_id
       JOIN milestone_events me
         ON me.ranking_id = bm.ranking_id
        AND me.profile_id = bm.profile_id
       WHERE bm.user_id = ?
         AND ${notSeedClause("u")}
         AND ${activeUserClause("u")}
         AND bm.rank_at_support IS NOT NULL
         AND bm.rank_at_support > ?
         AND me.type = ?
         AND me.created_at > bm.supported_at`
    )
    .get(userId, cfg.outsideTopK, milestoneType)) as unknown as {
    moments: number;
    nominees: number;
    first_at: string | null;
  };
  const qualifies =
    row.moments >= cfg.minMoments && row.nominees >= cfg.minDistinctNominees;
  return {
    key: "underdog_backer",
    qualifies,
    evidenceSummary: underdogBackerSummary(
      row.moments,
      row.nominees,
      cfg.outsideTopK,
      cfg.enteredTopK
    ),
    window: { from: row.first_at ?? "", to: "" },
  };
}

// Calendar-month span between two sqlite datetime strings (inclusive:
// 2026-01-31 → 2026-03-01 spans 3 months).
function monthSpan(fromIso: string, toIso: string): number {
  const a = new Date(fromIso.replace(" ", "T") + "Z");
  const b = new Date(toIso.replace(" ", "T") + "Z");
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 1;
  return (
    (b.getUTCFullYear() - a.getUTCFullYear()) * 12 +
    (b.getUTCMonth() - a.getUTCMonth()) +
    1
  );
}

async function loyalBackerEvidence(
  userId: string,
  rules: IdentityRules
): Promise<IdentityEvidence> {
  const cfg = rules.loyal_backer;
  const rows = (await db
    .prepare(
      `SELECT COUNT(*) AS moments,
              MIN(bm.supported_at) AS first_at,
              MAX(bm.supported_at) AS last_at
       FROM backing_moments bm
       JOIN users u ON u.id = bm.user_id
       WHERE bm.user_id = ?
         AND ${notSeedClause("u")}
         AND ${activeUserClause("u")}
       GROUP BY bm.ranking_id, bm.profile_id
       HAVING moments >= ?`
    )
    .all(userId, cfg.minMoments)) as unknown as {
    moments: number;
    first_at: string;
    last_at: string;
  }[];
  let best: { moments: number; months: number; first: string } | null = null;
  for (const r of rows) {
    const months = monthSpan(r.first_at, r.last_at);
    if (!best || r.moments > best.moments) {
      best = { moments: r.moments, months, first: r.first_at };
    }
  }
  const qualifies =
    best !== null && best.months >= cfg.minMonths;
  return {
    key: "loyal_backer",
    qualifies,
    evidenceSummary: loyalBackerSummary(
      best?.moments ?? 0,
      best?.months ?? 0
    ),
    window: { from: best?.first ?? "", to: "" },
  };
}

export async function computeIdentityEvidence(
  userId: string,
  rules: IdentityRules = IDENTITY_RULES
): Promise<IdentityEvidence[]> {
  const [talent, underdog, loyal] = await Promise.all([
    talentSpotterEvidence(userId, rules),
    underdogBackerEvidence(userId, rules),
    loyalBackerEvidence(userId, rules),
  ]);
  return [talent, underdog, loyal];
}

// ── Awarding (idempotent; notifies on first award) ─────────────────────

export interface AwardRunResult {
  evaluated: number;
  awarded: { userId: string; key: IdentityKey; summary: string }[];
}

async function awardForUser(
  userId: string,
  rules: IdentityRules
): Promise<{ key: IdentityKey; summary: string }[]> {
  const evidence = await computeIdentityEvidence(userId, rules);
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const newlyAwarded: { key: IdentityKey; summary: string }[] = [];
  const existing = new Set(
    (await getIdentityAwards(userId)).map((a) => a.identityKey)
  );
  for (const e of evidence) {
    if (!e.qualifies || existing.has(e.key)) continue;
    const window = { from: e.window.from, to: now };
    const result = await db
      .prepare(
        `INSERT OR IGNORE INTO identity_awards
          (id, user_id, identity_key, engine_version, evidence_window,
           thresholds_json, evidence_summary, display_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        newId(),
        userId,
        e.key,
        IDENTITY_ENGINE_VERSION,
        JSON.stringify(window),
        JSON.stringify(rules[e.key]),
        e.evidenceSummary,
        IDENTITY_KEYS.indexOf(e.key)
      );
    if (result.changes > 0) {
      newlyAwarded.push({ key: e.key, summary: e.evidenceSummary });
    }
  }
  return newlyAwarded;
}

// Evaluates identities for a set of users (deduplicated), persists new
// awards idempotently, and notifies each user of a NEWLY earned identity
// through the Phase 3 center (pref + 5/day cap are enforced inside
// createNotification). Chunked so a big backfill doesn't hold the cron
// open. Reads only the additive identity_awards table on the write
// path — conviction_records / backing_moments / credit_transactions /
// milestone_events writes are never touched.
export async function awardIdentitiesForUsers(
  userIds: string[],
  rules: IdentityRules = IDENTITY_RULES
): Promise<AwardRunResult> {
  const result: AwardRunResult = { evaluated: 0, awarded: [] };
  const unique = [...new Set(userIds)];
  for (const chunk of chunked(unique, 100)) {
    for (const userId of chunk) {
      result.evaluated++;
      const fresh = await awardForUser(userId, rules);
      for (const a of fresh) {
        result.awarded.push({ userId, key: a.key, summary: a.summary });
        await createNotification({
          userId,
          type: "identity_earned",
          title: identityEarnedTitle(a.key),
          body: identityEarnedBody(a.summary),
          link: `/u/${userId}`,
        });
      }
    }
  }
  return result;
}

function chunked<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Candidates for the daily run: users with a backing moment in the last
// day OR a new early backer award in the last day (1 statement).
export async function findIdentityCandidates(): Promise<string[]> {
  const rows = (await db
    .prepare(
      `SELECT DISTINCT user_id AS user_id FROM backing_moments
       WHERE supported_at >= datetime('now', '-1 day')
       UNION
       SELECT DISTINCT user_id AS user_id FROM early_backer_awards
       WHERE awarded_at >= datetime('now', '-1 day')`
    )
    .all()) as unknown as { user_id: string }[];
  return rows.map((r) => r.user_id);
}

// Full backfill (one-off / admin): every user with any backing moment.
// NOT wired into the daily cron — bounded daily candidates are.
export async function backfillIdentities(
  rules: IdentityRules = IDENTITY_RULES
): Promise<AwardRunResult> {
  const rows = (await db
    .prepare(
      `SELECT DISTINCT bm.user_id AS user_id
       FROM backing_moments bm
       JOIN users u ON u.id = bm.user_id
       WHERE ${notSeedClause("u")} AND ${activeUserClause("u")}`
    )
    .all()) as unknown as { user_id: string }[];
  return awardIdentitiesForUsers(rows.map((r) => r.user_id), rules);
}

// ── Viewer gating ──────────────────────────────────────────────────────
// Identity summaries are counts-only (no names, dates, reasons), so for
// a user with public activity they render to other viewers — the same
// posture as the "Early Backer ×N" stat chip. A user with NO public
// activity (fully-private profile) keeps identities owner-only.
// The owner always sees everything.
export function visibleIdentityAwards(
  awards: IdentityAward[],
  isOwner: boolean,
  targetHasPublicActivity: boolean
): IdentityAward[] {
  if (isOwner || targetHasPublicActivity) return awards;
  return [];
}

// ── Owner-editable display order ───────────────────────────────────────

export async function setIdentityDisplayOrder(
  userId: string,
  order: IdentityKey[]
): Promise<void> {
  const awards = await getIdentityAwards(userId);
  const owned = new Set(awards.map((a) => a.identityKey));
  for (const key of order) {
    if (!isIdentityKey(key) || !owned.has(key)) {
      throw new Error("invalid identity order");
    }
  }
  let n = 0;
  for (const key of order) {
    await db
      .prepare(
        `UPDATE identity_awards SET display_order = ?
         WHERE user_id = ? AND identity_key = ?`
      )
      .run(n++, userId, key);
  }
}
