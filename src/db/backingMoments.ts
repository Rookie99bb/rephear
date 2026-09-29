import { db } from "./client";
import { newId } from "@/lib/id";
import { growthStageForRank, type GrowthStage } from "@/lib/supportReasons";

// Phase 5.1 (Support Story & Backing Journey): backing_moments — one
// IMMUTABLE row per completed paid Support capturing "the moment someone
// chose to believe in someone else".
//
// The snapshot is taken BEFORE the payment's credits land (pre-payment
// state = the world the supporter actually judged): the nominee's
// Most-Supported rank, total credits, and distinct supporter count
// (seed_community_* excluded, same query as getSupportedRankSnapshot).
// backer_number = backer_count_at_support + 1 ("You became Backer #39").
// growth_stage_at_support is computed once and never recomputed.
// visibility_at_support is an AUDIT field — rendering always uses
// read-time effective visibility (see src/db/visibility.ts), so a later
// privacy flip retroactively hides the moment from public surfaces.
//
// Rows are NEVER updated and NEVER backfilled: supports completed
// before this table existed have no moments. History is never
// fabricated.
//
// Idempotent under webhook redelivery: UNIQUE(payment_id) +
// INSERT OR IGNORE. On conflict the existing snapshot wins — it is
// never overwritten.

export interface BackingMoment {
  id: string;
  userId: string;
  rankingId: string;
  profileId: string;
  paymentId: string;
  credits: number;
  supportedAt: string;
  rankAtSupport: number | null;
  totalCreditsAtSupport: number | null;
  backerCountAtSupport: number | null;
  backerNumber: number | null;
  growthStageAtSupport: GrowthStage | null;
  supportReason: string | null;
  supportReasonText: string | null;
  visibilityAtSupport: string | null;
}

interface BackingMomentRow {
  id: string;
  user_id: string;
  ranking_id: string;
  profile_id: string;
  payment_id: string;
  credits: number;
  supported_at: string;
  rank_at_support: number | null;
  total_credits_at_support: number | null;
  backer_count_at_support: number | null;
  backer_number: number | null;
  growth_stage_at_support: string | null;
  support_reason: string | null;
  support_reason_text: string | null;
  visibility_at_support: string | null;
}

function toMoment(row: BackingMomentRow): BackingMoment {
  return {
    id: row.id,
    userId: row.user_id,
    rankingId: row.ranking_id,
    profileId: row.profile_id,
    paymentId: row.payment_id,
    credits: row.credits,
    supportedAt: row.supported_at,
    rankAtSupport: row.rank_at_support,
    totalCreditsAtSupport: row.total_credits_at_support,
    backerCountAtSupport: row.backer_count_at_support,
    backerNumber: row.backer_number,
    growthStageAtSupport: (row.growth_stage_at_support ??
      null) as GrowthStage | null,
    supportReason: row.support_reason,
    supportReasonText: row.support_reason_text,
    visibilityAtSupport: row.visibility_at_support,
  };
}

export async function getBackingMoment(
  paymentId: string
): Promise<BackingMoment | null> {
  const row = (await db
    .prepare(`SELECT * FROM backing_moments WHERE payment_id = ?`)
    .get(paymentId)) as unknown as BackingMomentRow | undefined;
  return row ? toMoment(row) : null;
}

// Records one immutable moment per completed payment. Returns
// { created: true } only when this call created the row; a redelivered
// webhook (or any re-insert attempt) leaves the existing snapshot
// untouched — the snapshot is NEVER rewritten.
export async function recordBackingMoment(params: {
  userId: string;
  rankingId: string;
  profileId: string;
  paymentId: string;
  credits: number;
  rankAtSupport: number | null;
  totalCreditsAtSupport: number | null;
  backerCountAtSupport: number | null;
  supportReason: string | null;
  supportReasonText: string | null;
  visibilityAtSupport: "public" | "private";
}): Promise<{ created: boolean; moment: BackingMoment }> {
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO backing_moments
        (id, user_id, ranking_id, profile_id, payment_id, credits,
         rank_at_support, total_credits_at_support, backer_count_at_support,
         backer_number, growth_stage_at_support,
         support_reason, support_reason_text, visibility_at_support)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      newId(),
      params.userId,
      params.rankingId,
      params.profileId,
      params.paymentId,
      params.credits,
      params.rankAtSupport,
      params.totalCreditsAtSupport,
      params.backerCountAtSupport,
      params.backerCountAtSupport != null
        ? params.backerCountAtSupport + 1
        : null,
      growthStageForRank(params.rankAtSupport),
      params.supportReason,
      params.supportReasonText,
      params.visibilityAtSupport
    );
  return {
    created: result.changes > 0,
    moment: (await getBackingMoment(params.paymentId))!,
  };
}
