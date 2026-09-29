import { db } from "./client";
import { newId } from "@/lib/id";

export interface ConvictionRecord {
  id: string;
  userId: string;
  rankingId: string;
  profileId: string;
  firstSupportedAt: string;
  // The nominee's Most-Supported rank at the moment the first payment
  // completed — the world the supporter actually judged. Computed from
  // the same totals as the public leaderboard (1 + #profiles with
  // strictly greater credit total). NULL only if the ranking had no
  // computable board at the time (should not happen; stored defensively).
  rankAtFirstSupport: number | null;
  // Distinct real (non-seed) supporters with net-positive credits BEFORE
  // this payment's credits landed. The supporter is number
  // (supporterCountAtFirstSupport + 1).
  supporterCountAtFirstSupport: number | null;
  firstPaymentId: string;
  // What the first paid Support actually cost, in the currency Stripe
  // charged (no FX — usd | gbp), and the visibility choice made at that
  // checkout. Immutable like the rest of the first-support snapshot.
  firstAmountCents: number | null;
  firstCurrency: string;
  firstVisibility: "public" | "private" | null;
  lastSupportedAt: string | null;
}

interface ConvictionRow {
  id: string;
  user_id: string;
  ranking_id: string;
  profile_id: string;
  first_supported_at: string;
  rank_at_first_support: number | null;
  supporter_count_at_first_support: number | null;
  first_payment_id: string;
  first_amount_cents: number | null;
  first_currency: string;
  first_visibility: string | null;
  last_supported_at: string | null;
}

function toRecord(row: ConvictionRow): ConvictionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    rankingId: row.ranking_id,
    profileId: row.profile_id,
    firstSupportedAt: row.first_supported_at,
    rankAtFirstSupport: row.rank_at_first_support,
    supporterCountAtFirstSupport: row.supporter_count_at_first_support,
    firstPaymentId: row.first_payment_id,
    firstAmountCents: row.first_amount_cents,
    firstCurrency: row.first_currency,
    firstVisibility:
      row.first_visibility === "private" ? "private" : row.first_visibility === "public" ? "public" : null,
    lastSupportedAt: row.last_supported_at,
  };
}

export async function getConvictionRecord(
  userId: string,
  rankingId: string,
  profileId: string
): Promise<ConvictionRecord | null> {
  const row = (await db
    .prepare(
      `SELECT * FROM conviction_records
       WHERE user_id = ? AND ranking_id = ? AND profile_id = ?`
    )
    .get(userId, rankingId, profileId)) as unknown as ConvictionRow | undefined;
  return row ? toRecord(row) : null;
}

// Records the §4 conviction snapshot. Exactly one row per
// (user, ranking, nominee): the FIRST paid Support creates it with the
// pre-payment snapshot; repeat supports only bump last_supported_at —
// first_supported_at / rank_at_first_support /
// supporter_count_at_first_support / first_amount_cents / first_currency
// / first_visibility are NEVER rewritten.
// Returns { created: true } only when this call created the row.
// Idempotent under webhook redelivery: INSERT OR IGNORE on the UNIQUE
// constraint, and the update path only touches last_supported_at.
export async function recordConviction(params: {
  userId: string;
  rankingId: string;
  profileId: string;
  rankAtSupport: number | null;
  supporterCountAtSupport: number | null;
  paymentId: string;
  amountCents: number;
  currency: string;
  visibility: "public" | "private";
}): Promise<{ created: boolean; record: ConvictionRecord }> {
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO conviction_records
        (id, user_id, ranking_id, profile_id, rank_at_first_support,
         supporter_count_at_first_support, first_payment_id,
         first_amount_cents, first_currency, first_visibility)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      newId(),
      params.userId,
      params.rankingId,
      params.profileId,
      params.rankAtSupport,
      params.supporterCountAtSupport,
      params.paymentId,
      params.amountCents,
      params.currency,
      params.visibility
    );
  if (result.changes > 0) {
    return {
      created: true,
      record: (await getConvictionRecord(
        params.userId,
        params.rankingId,
        params.profileId
      ))!,
    };
  }
  await db
    .prepare(
      `UPDATE conviction_records
       SET last_supported_at = datetime('now')
       WHERE user_id = ? AND ranking_id = ? AND profile_id = ?`
    )
    .run(params.userId, params.rankingId, params.profileId);
  return {
    created: false,
    record: (await getConvictionRecord(
      params.userId,
      params.rankingId,
      params.profileId
    ))!,
  };
}
