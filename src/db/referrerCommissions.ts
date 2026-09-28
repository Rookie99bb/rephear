import { db, rawClient } from "./client";
import { newId } from "@/lib/id";
import { findPaymentById } from "./payments";
import { findReferralByNewUserId } from "./referrals";
import { recordAuditLog, AUDIT_ACTIONS } from "./auditLog";
import { emitNotificationEvent } from "@/lib/notificationEvents";
import type {
  ReferralCommission,
  ReferralCommissionRule,
  ReferralCommissionStatus,
  ReferralPayout,
  ReferralPayoutStatus,
  ReferralRiskFlag,
  ReferrerProfile,
  CommissionAdjustment,
  PayoutItem,
  RiskFlagSeverity,
  RiskFlagStatus,
} from "@/lib/types";

// Current T&Cs version users must accept before they can withdraw.
// Bump when the terms copy changes; acceptTerms() stamps this value.
export const CURRENT_TERMS_VERSION = 1;
export type { RiskFlagSeverity } from "@/lib/types";

// System actor for automated commission actions (webhook booking,
// reversal, cron release). Follows the codebase convention (hideRankings,
// pruneLegacyRankings): a real user row so audit_logs.actor_user_id
// references stay valid.
const SYSTEM_ACCOUNT_EMAIL = "team@rephear.com";
const SYSTEM_ACCOUNT_NAME = "RepHear Team";

async function getSystemUserId(): Promise<string> {
  const existing = (await db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(SYSTEM_ACCOUNT_EMAIL)) as unknown as { id: string } | undefined;
  if (existing) return existing.id;
  const { randomUUID } = await import("crypto");
  const bcrypt = (await import("bcryptjs")).default;
  const id = newId();
  await db
    .prepare(
      `INSERT INTO users (id, email, name, password_hash, location, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    )
    .run(
      id,
      SYSTEM_ACCOUNT_EMAIL,
      SYSTEM_ACCOUNT_NAME,
      bcrypt.hashSync(randomUUID(), 10),
      "London"
    );
  return id;
}

function toSqliteDatetime(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function toRule(row: Record<string, unknown>): ReferralCommissionRule {
  return {
    version: row.version as number,
    rateBps: row.rate_bps as number,
    windowDays: row.window_days as number,
    freezeDays: row.freeze_days as number,
    minPayoutCents: row.min_payout_cents as number,
    currency: row.currency as string,
    effectiveFrom: row.effective_from as string,
  };
}

function toProfile(row: Record<string, unknown>): ReferrerProfile {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    status: row.status as ReferrerProfile["status"],
    termsVersion: row.terms_version as number,
    termsAcceptedAt: row.terms_accepted_at as string | null,
    createdAt: row.created_at as string,
  };
}

function toCommission(row: Record<string, unknown>): ReferralCommission {
  return {
    id: row.id as string,
    referralId: row.referral_id as string,
    paymentId: row.payment_id as string,
    referrerId: row.referrer_id as string,
    grossCents: row.gross_cents as number,
    rateBps: row.rate_bps as number,
    commissionCents: row.commission_cents as number,
    status: row.status as ReferralCommissionStatus,
    ruleVersion: row.rule_version as number,
    availableAt: row.available_at as string,
    allocatedPayoutId: row.allocated_payout_id as string | null,
    createdAt: row.created_at as string,
  };
}

function toAdjustment(row: Record<string, unknown>): CommissionAdjustment {
  return {
    id: row.id as string,
    commissionId: row.commission_id as string,
    amountCents: row.amount_cents as number,
    reason: row.reason as string,
    actorUserId: row.actor_user_id as string,
    createdAt: row.created_at as string,
  };
}

function toPayout(row: Record<string, unknown>): ReferralPayout {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    amountCents: row.amount_cents as number,
    currency: row.currency as string,
    status: row.status as ReferralPayoutStatus,
    providerRef: row.provider_ref as string,
    payoutContact: row.payout_contact as string,
    requestedAt: row.requested_at as string,
    reviewedAt: row.reviewed_at as string | null,
    reviewedBy: row.reviewed_by as string | null,
    adminNotes: row.admin_notes as string,
  };
}

function toRiskFlag(row: Record<string, unknown>): ReferralRiskFlag {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    type: row.type as string,
    severity: row.severity as RiskFlagSeverity,
    evidenceRef: row.evidence_ref as string,
    status: row.status as RiskFlagStatus,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    resolvedAt: row.resolved_at as string | null,
  };
}

// Net value of one commission = booked cents + append-only adjustments.
// Reversed commissions are excluded from every balance by status filter,
// never by deleting rows.
const NET_CENTS_SQL = `c.commission_cents + COALESCE(
  (SELECT SUM(amount_cents) FROM commission_adjustments a WHERE a.commission_id = c.id), 0
)`;

// ---------------------------------------------------------------- rules

export async function getCurrentRule(): Promise<ReferralCommissionRule> {
  const row = (await db
    .prepare(
      "SELECT * FROM referral_commission_rules ORDER BY version DESC LIMIT 1"
    )
    .get()) as unknown as Record<string, unknown> | undefined;
  if (!row) throw new Error("No referral commission rule configured.");
  return toRule(row);
}

// ------------------------------------------------------------- profiles

export async function getOrCreateReferrerProfile(
  userId: string
): Promise<ReferrerProfile> {
  const existing = (await db
    .prepare("SELECT * FROM referrer_profiles WHERE user_id = ?")
    .get(userId)) as unknown as Record<string, unknown> | undefined;
  if (existing) return toProfile(existing);
  const id = newId();
  try {
    await db
      .prepare("INSERT INTO referrer_profiles (id, user_id) VALUES (?, ?)")
      .run(id, userId);
  } catch {
    // Race: another request created it first.
  }
  const row = (await db
    .prepare("SELECT * FROM referrer_profiles WHERE user_id = ?")
    .get(userId)) as unknown as Record<string, unknown> | undefined;
  return toProfile(row!);
}

export async function acceptTerms(userId: string): Promise<void> {
  await getOrCreateReferrerProfile(userId);
  await db
    .prepare(
      `UPDATE referrer_profiles
       SET terms_version = ?, terms_accepted_at = datetime('now')
       WHERE user_id = ?`
    )
    .run(CURRENT_TERMS_VERSION, userId);
}

export async function setReferrerStatus(
  userId: string,
  status: "active" | "paused"
): Promise<void> {
  await getOrCreateReferrerProfile(userId);
  await db
    .prepare("UPDATE referrer_profiles SET status = ? WHERE user_id = ?")
    .run(status, userId);
}

// ---------------------------------------------------------------- funnel

export interface FunnelStats {
  clicksAllTime: number;
  registrations7d: number;
  registrations30d: number;
  payingReferrals7d: number;
  payingReferrals30d: number;
}

export async function getFunnelStats(userId: string): Promise<FunnelStats> {
  const [inv, reg7, reg30, pay7, pay30] = await Promise.all([
    db
      .prepare("SELECT total_visits AS c FROM invitations WHERE owner_id = ?")
      .get<{ c: number }>(userId),
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM referrals
         WHERE referrer_id = ? AND datetime(created_at) >= datetime('now', '-7 days')`
      )
      .get<{ c: number }>(userId),
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM referrals
         WHERE referrer_id = ? AND datetime(created_at) >= datetime('now', '-30 days')`
      )
      .get<{ c: number }>(userId),
    db
      .prepare(
        `SELECT COUNT(DISTINCT r.new_user_id) AS c
         FROM referral_commissions c
         JOIN referrals r ON r.id = c.referral_id
         WHERE c.referrer_id = ? AND c.status != 'reversed'
           AND datetime(c.created_at) >= datetime('now', '-7 days')`
      )
      .get<{ c: number }>(userId),
    db
      .prepare(
        `SELECT COUNT(DISTINCT r.new_user_id) AS c
         FROM referral_commissions c
         JOIN referrals r ON r.id = c.referral_id
         WHERE c.referrer_id = ? AND c.status != 'reversed'
           AND datetime(c.created_at) >= datetime('now', '-30 days')`
      )
      .get<{ c: number }>(userId),
  ]);
  return {
    clicksAllTime: inv?.c ?? 0,
    registrations7d: reg7?.c ?? 0,
    registrations30d: reg30?.c ?? 0,
    payingReferrals7d: pay7?.c ?? 0,
    payingReferrals30d: pay30?.c ?? 0,
  };
}

// --------------------------------------------------------------- balances

export interface CommissionBalances {
  pendingCents: number;
  availableCents: number;
  lifetimeEarnedCents: number;
  lifetimePaidCents: number;
}

export async function getBalances(userId: string): Promise<CommissionBalances> {
  const row = (await db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN c.status = 'pending' THEN (${NET_CENTS_SQL}) END), 0) AS pending_cents,
        COALESCE(SUM(CASE WHEN c.status = 'available' AND c.allocated_payout_id IS NULL THEN (${NET_CENTS_SQL}) END), 0) AS available_cents,
        COALESCE(SUM(CASE WHEN c.status IN ('pending','available','paid') THEN (${NET_CENTS_SQL}) END), 0) AS lifetime_earned_cents,
        COALESCE(SUM(CASE WHEN c.status = 'paid' THEN (${NET_CENTS_SQL}) END), 0) AS lifetime_paid_cents
       FROM referral_commissions c
       WHERE c.referrer_id = ?`
    )
    .get(userId)) as unknown as
    | {
        pending_cents: number;
        available_cents: number;
        lifetime_earned_cents: number;
        lifetime_paid_cents: number;
      }
    | undefined;
  return {
    pendingCents: row?.pending_cents ?? 0,
    availableCents: row?.available_cents ?? 0,
    lifetimeEarnedCents: row?.lifetime_earned_cents ?? 0,
    lifetimePaidCents: row?.lifetime_paid_cents ?? 0,
  };
}

// ---------------------------------------------------------------- booking

export async function findCommissionByPaymentId(
  paymentId: string
): Promise<ReferralCommission | null> {
  const row = (await db
    .prepare("SELECT * FROM referral_commissions WHERE payment_id = ?")
    .get(paymentId)) as unknown as Record<string, unknown> | undefined;
  return row ? toCommission(row) : null;
}

// Books one commission for a completed payment. NEVER throws and never
// blocks the caller's main flow (Stripe webhook): any failure is logged
// and swallowed. Idempotent via UNIQUE(payment_id) — a redelivered
// webhook returns the existing row.
//
// Rules enforced here:
// - payment must be 'completed' (only real, finished Support counts)
// - payer must have a referrals row (cash attribution follows the invite
//   link ONLY — campaign /s/ links never reach this function)
// - payment must fall inside the 180-day window from referee signup
// - rate is snapshotted from the current rule version onto the row
export async function bookCommissionForPayment(
  paymentId: string
): Promise<ReferralCommission | null> {
  try {
    const payment = await findPaymentById(paymentId);
    if (!payment || payment.status !== "completed") return null;

    const existing = await findCommissionByPaymentId(paymentId);
    if (existing) return existing;

    const referral = await findReferralByNewUserId(payment.userId);
    if (!referral) return null; // not a referred user — nothing to book

    const rule = await getCurrentRule();
    const signupAt = new Date(referral.createdAt.replace(" ", "T") + "Z");
    const completedAt = payment.completedAt
      ? new Date(payment.completedAt.replace(" ", "T") + "Z")
      : new Date();
    const windowMs = rule.windowDays * 24 * 60 * 60 * 1000;
    if (completedAt.getTime() - signupAt.getTime() > windowMs) {
      return null; // outside the attribution window
    }
    if (completedAt.getTime() < signupAt.getTime()) {
      return null; // payment predates the referral — corrupt data, skip
    }

    const commissionCents = Math.floor(
      (payment.amountCents * rule.rateBps) / 10000
    );
    if (commissionCents <= 0) return null;

    const availableAt = toSqliteDatetime(
      new Date(completedAt.getTime() + rule.freezeDays * 24 * 60 * 60 * 1000)
    );

    await getOrCreateReferrerProfile(referral.referrerId);

    const id = newId();
    try {
      await db
        .prepare(
          `INSERT INTO referral_commissions
            (id, referral_id, payment_id, referrer_id, gross_cents, rate_bps,
             commission_cents, status, rule_version, available_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
        )
        .run(
          id,
          referral.id,
          paymentId,
          referral.referrerId,
          payment.amountCents,
          rule.rateBps,
          commissionCents,
          rule.version,
          availableAt
        );
    } catch {
      // UNIQUE(payment_id) race — another worker booked it first.
      return await findCommissionByPaymentId(paymentId);
    }

    const commission = (await findCommissionByPaymentId(paymentId))!;
    emitNotificationEvent({
      type: "referral_commission_earned",
      referrerUserId: commission.referrerId,
      commissionId: commission.id,
      amountCents: commission.commissionCents,
      currency: rule.currency,
    });
    return commission;
  } catch (err) {
    console.error("[referrerCommissions] bookCommissionForPayment failed:", err);
    return null;
  }
}

// --------------------------------------------------------------- release

// Daily cron: pending -> available once the T+14 freeze has elapsed.
// Skips referrers who are paused or carry an open risk flag — those need
// a human decision first. Returns the released rows for notifications.
export async function releaseMaturedCommissions(): Promise<ReferralCommission[]> {
  const eligible = (await db
    .prepare(
      `SELECT c.* FROM referral_commissions c
       WHERE c.status = 'pending'
         AND datetime(c.available_at) <= datetime('now')
         AND NOT EXISTS (
           SELECT 1 FROM referral_risk_flags f
           WHERE f.user_id = c.referrer_id AND f.status = 'open'
         )
         AND NOT EXISTS (
           SELECT 1 FROM referrer_profiles p
           WHERE p.user_id = c.referrer_id AND p.status = 'paused'
         )
       ORDER BY c.available_at ASC`
    )
    .all()) as unknown as Record<string, unknown>[];
  if (eligible.length === 0) return [];

  const ids = eligible.map((r) => r.id as string);
  const placeholders = ids.map(() => "?").join(",");
  await db
    .prepare(
      `UPDATE referral_commissions SET status = 'available'
       WHERE id IN (${placeholders}) AND status = 'pending'`
    )
    .run(...ids);

  const released = eligible.map(toCommission);
  for (const c of released) {
    emitNotificationEvent({
      type: "referral_commission_available",
      referrerUserId: c.referrerId,
      commissionId: c.id,
      amountCents: c.commissionCents,
    });
  }
  return released;
}

// --------------------------------------------------------------- reversal

async function netCentsForCommission(commissionId: string): Promise<number> {
  const row = (await db
    .prepare(
      `SELECT commission_cents + COALESCE(
         (SELECT SUM(amount_cents) FROM commission_adjustments WHERE commission_id = ?), 0
       ) AS net
       FROM referral_commissions WHERE id = ?`
    )
    .get(commissionId, commissionId)) as unknown as { net: number } | undefined;
  return row?.net ?? 0;
}

async function appendAdjustment(params: {
  commissionId: string;
  amountCents: number;
  reason: string;
  actorUserId: string;
}): Promise<CommissionAdjustment> {
  const id = newId();
  await db
    .prepare(
      `INSERT INTO commission_adjustments
        (id, commission_id, amount_cents, reason, actor_user_id)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(id, params.commissionId, params.amountCents, params.reason, params.actorUserId);
  const row = (await db
    .prepare("SELECT * FROM commission_adjustments WHERE id = ?")
    .get(id)) as unknown as Record<string, unknown>;
  return toAdjustment(row);
}

// Reverses the commission for a refunded/disputed payment. NEVER throws.
// - pending/available (not yet paid out): status -> 'reversed'. If the
//   commission was locked inside an open payout request, it is pulled
//   out of that payout and the payout amount is reduced accordingly.
// - paid: ledger keeps status 'paid' (money already left) but appends a
//   negative adjustment for the full net amount, pauses the referrer
//   profile (no further withdrawals), and opens a high-severity risk
//   flag for admin review — per PRD "负余额、暂停账户".
// - already 'reversed': no-op (idempotent for redelivered webhooks).
export async function reverseCommissionForPayment(
  paymentId: string,
  reason: "payment_refunded" | "payment_disputed"
): Promise<void> {
  try {
    const commission = await findCommissionByPaymentId(paymentId);
    if (!commission || commission.status === "reversed") return;
    const systemId = await getSystemUserId();

    if (commission.status === "paid") {
      // Paid-out money can't be un-paid: claw back via a negative
      // adjustment (PRD: 负 adjustment) and pause the referrer pending
      // human review. The commission row itself stays 'paid'.
      const net = await netCentsForCommission(commission.id);
      if (net !== 0) {
        await appendAdjustment({
          commissionId: commission.id,
          amountCents: -net,
          reason,
          actorUserId: systemId,
        });
      }
      await setReferrerStatus(commission.referrerId, "paused");
      const flag = await addRiskFlag({
        userId: commission.referrerId,
        type: "refund_after_payout",
        severity: "high",
        evidenceRef: `payment:${paymentId}`,
        createdBy: systemId,
      });
      await recordAuditLog({
        actorUserId: systemId,
        action: AUDIT_ACTIONS.REFERRER_PAUSED,
        targetType: "referrer_profile",
        targetId: commission.referrerId,
        details: { reason: "refund_after_payout", paymentId },
      });
      await recordAuditLog({
        actorUserId: systemId,
        action: AUDIT_ACTIONS.RISK_FLAG_ADDED,
        targetType: "referral_risk_flag",
        targetId: flag.id,
        details: {
          userId: commission.referrerId,
          type: "refund_after_payout",
          severity: "high",
          evidenceRef: `payment:${paymentId}`,
        },
      });
    } else {
      // Pull out of any open payout request first, then reverse. Reduce
      // the payout by the item's ACTUAL allocated amount (net), not the
      // original commission, so adjustments stay consistent.
      if (commission.allocatedPayoutId) {
        const item = (await db
          .prepare(
            "SELECT allocated_amount_cents FROM payout_items WHERE commission_id = ?"
          )
          .get(commission.id)) as unknown as
          | { allocated_amount_cents: number }
          | undefined;
        const allocated = item?.allocated_amount_cents ?? 0;
        await db
          .prepare("DELETE FROM payout_items WHERE commission_id = ?")
          .run(commission.id);
        if (allocated !== 0) {
          await db
            .prepare(
              `UPDATE referral_payouts
               SET amount_cents = amount_cents - ?
               WHERE id = ?`
            )
            .run(allocated, commission.allocatedPayoutId);
        }
        await db
          .prepare(
            `UPDATE referral_commissions SET allocated_payout_id = NULL WHERE id = ?`
          )
          .run(commission.id);
      }
      await db
        .prepare(
          `UPDATE referral_commissions SET status = 'reversed'
           WHERE id = ? AND status IN ('pending', 'available')`
        )
        .run(commission.id);
      // Zero-amount adjustment records the reversal reason in the ledger.
      await appendAdjustment({
        commissionId: commission.id,
        amountCents: 0,
        reason,
        actorUserId: systemId,
      });
    }

    await recordAuditLog({
      actorUserId: systemId,
      action: AUDIT_ACTIONS.COMMISSION_REVERSED,
      targetType: "referral_commission",
      targetId: commission.id,
      details: { paymentId, reason, priorStatus: commission.status },
    });
    emitNotificationEvent({
      type: "commission_reversed",
      referrerUserId: commission.referrerId,
      commissionId: commission.id,
      reason,
    });
  } catch (err) {
    console.error(
      "[referrerCommissions] reverseCommissionForPayment failed:",
      err
    );
  }
}

// ----------------------------------------------------------------- lists

export interface CommissionListItem {
  commission: ReferralCommission;
  refereeDisplay: string; // anonymized, e.g. "陈***" — never email/id
  refereeJoinedAt: string;
  adjustmentsCents: number;
}

// A referrer may only ever see their OWN data — every caller must scope
// by the session user id. Referee identity is anonymized per PRD.
export async function listCommissionsForReferrer(
  referrerId: string,
  opts: { status?: ReferralCommissionStatus; limit?: number; offset?: number } = {}
): Promise<CommissionListItem[]> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;
  const rows = (await db
    .prepare(
      `SELECT c.*,
              u.name AS referee_name,
              r.created_at AS referee_joined_at,
              COALESCE((SELECT SUM(amount_cents) FROM commission_adjustments a
                        WHERE a.commission_id = c.id), 0) AS adjustments_cents
       FROM referral_commissions c
       JOIN referrals r ON r.id = c.referral_id
       JOIN users u ON u.id = r.new_user_id
       WHERE c.referrer_id = ?
         ${opts.status ? "AND c.status = ?" : ""}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(
      ...(opts.status ? [referrerId, opts.status, limit, offset] : [referrerId, limit, offset])
    )) as unknown as (Record<string, unknown> & {
    referee_name: string;
    referee_joined_at: string;
    adjustments_cents: number;
  })[];
  return rows.map((r) => ({
    commission: toCommission(r),
    refereeDisplay: anonymizeName(r.referee_name),
    refereeJoinedAt: r.referee_joined_at,
    adjustmentsCents: r.adjustments_cents,
  }));
}

function anonymizeName(name: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "***";
  return trimmed.slice(0, 1) + "***";
}

export async function findPayoutById(
  payoutId: string
): Promise<ReferralPayout | null> {
  const row = (await db
    .prepare("SELECT * FROM referral_payouts WHERE id = ?")
    .get(payoutId)) as unknown as Record<string, unknown> | undefined;
  return row ? toPayout(row) : null;
}

export async function listPayoutsForUser(
  userId: string
): Promise<ReferralPayout[]> {
  const rows = (await db
    .prepare(
      "SELECT * FROM referral_payouts WHERE user_id = ? ORDER BY requested_at DESC"
    )
    .all(userId)) as unknown as Record<string, unknown>[];
  return rows.map(toPayout);
}

// ---------------------------------------------------------------- payouts

// Creates a withdrawal request locking the full available balance.
// Throws with a human-readable message when any eligibility check fails
// (caller surfaces it to the user). The allocation runs in a write
// transaction: either every commission is locked to the payout or none
// is — no double-spend, no partial locks.
export async function requestPayout(
  userId: string,
  payoutContact: string
): Promise<ReferralPayout> {
  const rule = await getCurrentRule();
  const profile = await getOrCreateReferrerProfile(userId);
  if (profile.status !== "active") {
    throw new Error("Your referrer account is paused — contact support.");
  }
  if (profile.termsVersion < CURRENT_TERMS_VERSION) {
    throw new Error("Please accept the latest Referrer Terms first.");
  }
  const openHigh = await countOpenRiskFlags(userId, "high");
  if (openHigh > 0) {
    throw new Error(
      "Withdrawals are on hold while your account is under review."
    );
  }
  if (!payoutContact.trim()) {
    throw new Error("Tell us where to send the payout (e.g. a PayPal email).");
  }

  const balances = await getBalances(userId);
  if (balances.availableCents < rule.minPayoutCents) {
    throw new Error(
      `You need at least ${(rule.minPayoutCents / 100).toFixed(2)} ${rule.currency} available to withdraw.`
    );
  }

  // Lock the actual available rows, valued at NET (commission minus any
  // adjustments). The payout total is the sum of those nets — never a
  // separately computed balance — so the header and the items always agree.
  const available = (await db
    .prepare(
      `SELECT c.id AS id,
              c.commission_cents + COALESCE(
                (SELECT SUM(amount_cents) FROM commission_adjustments WHERE commission_id = c.id), 0
              ) AS net_cents
       FROM referral_commissions c
       WHERE c.referrer_id = ? AND c.status = 'available' AND c.allocated_payout_id IS NULL
       ORDER BY c.available_at ASC, c.created_at ASC`
    )
    .all(userId)) as unknown as { id: string; net_cents: number }[];
  // Rows netted to zero or below carry nothing to pay out; they stay
  // 'available' for admin review rather than blocking the whole request.
  const payable = available.filter((r) => r.net_cents > 0);
  if (payable.length === 0) {
    throw new Error("No withdrawable commission right now.");
  }
  const totalNet = payable.reduce((sum, r) => sum + r.net_cents, 0);
  if (totalNet < rule.minPayoutCents) {
    throw new Error(
      `You need at least ${(rule.minPayoutCents / 100).toFixed(2)} ${rule.currency} available to withdraw.`
    );
  }

  const payoutId = newId();
  // Ensure migrations ran (rawClient below skips the readiness guard).
  await db.prepare("SELECT 1").get();
  const tx = await rawClient.transaction("write");
  try {
    await tx.execute({
      sql: `INSERT INTO referral_payouts
              (id, user_id, amount_cents, currency, payout_contact)
            VALUES (?, ?, ?, ?, ?)`,
      args: [payoutId, userId, totalNet, rule.currency, payoutContact.trim()],
    });
    for (const row of payable) {
      await tx.execute({
        sql: `INSERT INTO payout_items (id, payout_id, commission_id, allocated_amount_cents)
              VALUES (?, ?, ?, ?)`,
        args: [newId(), payoutId, row.id, row.net_cents],
      });
      // Guarded lock: if another request (or a refund) touched this row
      // first, rowsAffected is 0 and we abort the whole payout — no
      // partial locks, no dirty header.
      const locked = await tx.execute({
        sql: `UPDATE referral_commissions SET allocated_payout_id = ?
              WHERE id = ? AND allocated_payout_id IS NULL AND status = 'available'`,
        args: [payoutId, row.id],
      });
      if (Number(locked.rowsAffected) === 0) {
        await tx.rollback();
        throw new Error(
          "Your balance changed while submitting — please try again."
        );
      }
    }
    await tx.commit();
  } catch (err) {
    // Rollback is safe to attempt even if the error came from commit;
    // libsql ignores rollback on a finished transaction.
    try {
      await tx.rollback();
    } catch {
      // ignore
    }
    throw err;
  }

  const payoutRow = (await db
    .prepare("SELECT * FROM referral_payouts WHERE id = ?")
    .get(payoutId)) as unknown as Record<string, unknown>;
  const payout = toPayout(payoutRow);
  emitNotificationEvent({
    type: "payout_requested",
    userId,
    payoutId: payout.id,
    amountCents: payout.amountCents,
  });
  return payout;
}

// ------------------------------------------------------------------ admin

export interface AdminCommissionRow {
  commission: ReferralCommission;
  referrerName: string;
  referrerEmail: string;
  grossCents: number;
  adjustmentsCents: number;
}

export async function listAllCommissions(opts: {
  status?: ReferralCommissionStatus | "all";
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: AdminCommissionRow[]; total: number }> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;
  const statusFilter =
    opts.status && opts.status !== "all" ? "AND c.status = ?" : "";
  const searchFilter = opts.search
    ? "AND (u.name LIKE ? OR u.email LIKE ? OR c.payment_id LIKE ?)"
    : "";
  const args: unknown[] = [];
  if (opts.status && opts.status !== "all") args.push(opts.status);
  if (opts.search) {
    const like = `%${opts.search}%`;
    args.push(like, like, like);
  }

  const totalRow = (await db
    .prepare(
      `SELECT COUNT(*) AS c FROM referral_commissions c
       JOIN users u ON u.id = c.referrer_id
       WHERE 1 = 1 ${statusFilter} ${searchFilter}`
    )
    .get(...(args as string[]))) as unknown as { c: number } | undefined;

  const rows = (await db
    .prepare(
      `SELECT c.*, u.name AS referrer_name, u.email AS referrer_email,
              COALESCE((SELECT SUM(amount_cents) FROM commission_adjustments a
                        WHERE a.commission_id = c.id), 0) AS adjustments_cents
       FROM referral_commissions c
       JOIN users u ON u.id = c.referrer_id
       WHERE 1 = 1 ${statusFilter} ${searchFilter}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...(args as string[]), limit, offset)) as unknown as (Record<
    string,
    unknown
  > & {
    referrer_name: string;
    referrer_email: string;
    adjustments_cents: number;
  })[];

  return {
    total: totalRow?.c ?? 0,
    rows: rows.map((r) => {
      const commission = toCommission(r);
      return {
        commission,
        referrerName: r.referrer_name,
        referrerEmail: r.referrer_email,
        grossCents: commission.grossCents,
        adjustmentsCents: r.adjustments_cents,
      };
    }),
  };
}

export interface ReferrerAdminDetail {
  profile: ReferrerProfile;
  userName: string;
  userEmail: string;
  balances: CommissionBalances;
  openFlags: ReferralRiskFlag[];
}

export async function getReferrerAdminDetail(
  userId: string
): Promise<ReferrerAdminDetail | null> {
  const profile = await getOrCreateReferrerProfile(userId);
  const user = (await db
    .prepare("SELECT name, email FROM users WHERE id = ?")
    .get(userId)) as unknown as { name: string; email: string } | undefined;
  if (!user) return null;
  const [balances, openFlags] = await Promise.all([
    getBalances(userId),
    listRiskFlags(userId, "open"),
  ]);
  return {
    profile,
    userName: user.name,
    userEmail: user.email,
    balances,
    openFlags,
  };
}

export interface AdminPayoutRow {
  payout: ReferralPayout;
  userName: string;
  userEmail: string;
  itemCount: number;
}

export async function listPayoutRequests(
  status?: ReferralPayoutStatus | "all"
): Promise<AdminPayoutRow[]> {
  const rows = (await db
    .prepare(
      `SELECT p.*, u.name AS user_name, u.email AS user_email,
              (SELECT COUNT(*) FROM payout_items i WHERE i.payout_id = p.id) AS item_count
       FROM referral_payouts p
       JOIN users u ON u.id = p.user_id
       ${status && status !== "all" ? "WHERE p.status = ?" : ""}
       ORDER BY p.requested_at ASC`
    )
    .all(...(status && status !== "all" ? [status] : []))) as unknown as (Record<
    string,
    unknown
  > & { user_name: string; user_email: string; item_count: number })[];
  return rows.map((r) => ({
    payout: toPayout(r),
    userName: r.user_name,
    userEmail: r.user_email,
    itemCount: r.item_count,
  }));
}

// requested -> approved. Commissions stay locked (allocated) until paid.
export async function approvePayout(
  payoutId: string,
  reviewedBy: string,
  adminNotes: string
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE referral_payouts
       SET status = 'approved', reviewed_at = datetime('now'), reviewed_by = ?, admin_notes = ?
       WHERE id = ? AND status = 'requested'`
    )
    .run(reviewedBy, adminNotes, payoutId);
  return result.changes > 0;
}

// approved -> paid. The locked commissions flip to 'paid' atomically.
// Recompute each commission's NET (booked + adjustments) at approval
// time so late adjustments are reflected in the payout items.
export async function markPayoutPaid(
  payoutId: string,
  reviewedBy: string,
  providerRef: string,
  adminNotes: string
): Promise<boolean> {
  // Ensure migrations ran (rawClient below skips the readiness guard).
  await db.prepare("SELECT 1").get();
  const tx = await rawClient.transaction("write");
  try {
    const payoutRow = (await tx.execute({
      sql: "SELECT * FROM referral_payouts WHERE id = ?",
      args: [payoutId],
    })).rows[0] as unknown as Record<string, unknown> | undefined;
    if (!payoutRow || payoutRow.status !== "approved") {
      await tx.rollback();
      return false;
    }
    const items = (await tx.execute({
      sql: "SELECT * FROM payout_items WHERE payout_id = ?",
      args: [payoutId],
    })).rows as unknown as Record<string, unknown>[];
    if (items.length === 0) {
      await tx.rollback();
      throw new Error("This payout has no commissions attached.");
    }

    let totalNet = 0;
    for (const item of items) {
      const adjRow = (await tx.execute({
        sql: `SELECT COALESCE(SUM(amount_cents), 0) AS s FROM commission_adjustments WHERE commission_id = ?`,
        args: [item.commission_id as string],
      })).rows[0] as unknown as { s: number };
      const commRow = (await tx.execute({
        sql: "SELECT commission_cents FROM referral_commissions WHERE id = ?",
        args: [item.commission_id as string],
      })).rows[0] as unknown as { commission_cents: number };
      const net = (commRow?.commission_cents ?? 0) + (adjRow?.s ?? 0);
      totalNet += net;
      await tx.execute({
        sql: "UPDATE payout_items SET allocated_amount_cents = ? WHERE id = ?",
        args: [net, item.id as string],
      });
      // Guarded flip: if a refund/reversal touched this commission after
      // the request was approved, abort — never pay out a commission that
      // isn't 'available'. The admin can reject and let the user re-request.
      const flipped = await tx.execute({
        sql: `UPDATE referral_commissions
              SET status = 'paid', allocated_payout_id = NULL
              WHERE id = ? AND status = 'available'`,
        args: [item.commission_id as string],
      });
      if (Number(flipped.rowsAffected) === 0) {
        await tx.rollback();
        throw new Error(
          "A commission in this payout changed state (likely refunded) — review before paying."
        );
      }
    }
    await tx.execute({
      sql: `UPDATE referral_payouts
            SET status = 'paid', amount_cents = ?, provider_ref = ?,
                reviewed_at = datetime('now'), reviewed_by = ?, admin_notes = ?
            WHERE id = ? AND status = 'approved'`,
      args: [totalNet, providerRef, reviewedBy, adminNotes, payoutId],
    });
    await tx.commit();
  } catch (err) {
    try {
      await tx.rollback();
    } catch {
      // ignore
    }
    throw err;
  }

  const payout = (await db
    .prepare("SELECT * FROM referral_payouts WHERE id = ?")
    .get(payoutId)) as unknown as Record<string, unknown> | undefined;
  if (payout) {
    emitNotificationEvent({
      type: "payout_paid",
      userId: payout.user_id as string,
      payoutId,
      amountCents: payout.amount_cents as number,
    });
  }
  return true;
}

// requested/approved -> rejected. Locked commissions are released back
// to 'available' so the user can request again.
export async function rejectPayout(
  payoutId: string,
  reviewedBy: string,
  adminNotes: string
): Promise<boolean> {
  // Ensure migrations ran (rawClient below skips the readiness guard).
  await db.prepare("SELECT 1").get();
  const tx = await rawClient.transaction("write");
  try {
    const payoutRow = (await tx.execute({
      sql: "SELECT status FROM referral_payouts WHERE id = ?",
      args: [payoutId],
    })).rows[0] as unknown as { status: string } | undefined;
    if (!payoutRow || (payoutRow.status !== "requested" && payoutRow.status !== "approved")) {
      await tx.rollback();
      return false;
    }
    await tx.execute({
      sql: `UPDATE referral_commissions SET allocated_payout_id = NULL
            WHERE allocated_payout_id = ?`,
      args: [payoutId],
    });
    await tx.execute({
      sql: "DELETE FROM payout_items WHERE payout_id = ?",
      args: [payoutId],
    });
    await tx.execute({
      sql: `UPDATE referral_payouts
            SET status = 'rejected', reviewed_at = datetime('now'),
                reviewed_by = ?, admin_notes = ?
            WHERE id = ?`,
      args: [reviewedBy, adminNotes, payoutId],
    });
    await tx.commit();
    return true;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

// -------------------------------------------------------------- risk flags

export async function addRiskFlag(params: {
  userId: string;
  type: string;
  severity: RiskFlagSeverity;
  evidenceRef?: string;
  createdBy?: string;
}): Promise<ReferralRiskFlag> {
  const id = newId();
  const createdBy = params.createdBy ?? (await getSystemUserId());
  await db
    .prepare(
      `INSERT INTO referral_risk_flags
        (id, user_id, type, severity, evidence_ref, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      params.userId,
      params.type,
      params.severity,
      params.evidenceRef ?? "",
      createdBy
    );
  const row = (await db
    .prepare("SELECT * FROM referral_risk_flags WHERE id = ?")
    .get(id)) as unknown as Record<string, unknown>;
  return toRiskFlag(row);
}

export async function listRiskFlags(
  userId: string,
  status?: RiskFlagStatus | "all"
): Promise<ReferralRiskFlag[]> {
  const rows = (await db
    .prepare(
      `SELECT * FROM referral_risk_flags WHERE user_id = ?
       ${status && status !== "all" ? "AND status = ?" : ""}
       ORDER BY created_at DESC`
    )
    .all(...(status && status !== "all" ? [userId, status] : [userId]))) as unknown as Record<
    string,
    unknown
  >[];
  return rows.map(toRiskFlag);
}

export async function countOpenRiskFlags(
  userId: string,
  severity?: RiskFlagSeverity
): Promise<number> {
  const row = (await db
    .prepare(
      `SELECT COUNT(*) AS c FROM referral_risk_flags
       WHERE user_id = ? AND status = 'open' ${severity ? "AND severity = ?" : ""}`
    )
    .get(...(severity ? [userId, severity] : [userId]))) as unknown as
    | { c: number }
    | undefined;
  return row?.c ?? 0;
}

// cleared = false alarm, confirmed = fraud upheld (kept for audit).
export async function resolveRiskFlag(
  flagId: string,
  resolution: "cleared" | "confirmed"
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE referral_risk_flags
       SET status = ?, resolved_at = datetime('now')
       WHERE id = ? AND status = 'open'`
    )
    .run(resolution, flagId);
  return result.changes > 0;
}

export async function listAdjustmentsForCommission(
  commissionId: string
): Promise<CommissionAdjustment[]> {
  const rows = (await db
    .prepare(
      "SELECT * FROM commission_adjustments WHERE commission_id = ? ORDER BY created_at ASC"
    )
    .all(commissionId)) as unknown as Record<string, unknown>[];
  return rows.map(toAdjustment);
}

export async function listPayoutItems(
  payoutId: string
): Promise<PayoutItem[]> {
  const rows = (await db
    .prepare("SELECT * FROM payout_items WHERE payout_id = ? ORDER BY created_at ASC")
    .all(payoutId)) as unknown as Record<string, unknown>[];
  return rows.map(
    (r): PayoutItem => ({
      id: r.id as string,
      payoutId: r.payout_id as string,
      commissionId: r.commission_id as string,
      allocatedAmountCents: r.allocated_amount_cents as number,
      createdAt: r.created_at as string,
    })
  );
}

// Admin: every referrer currently carrying at least one open risk flag,
// with counts. Used by the Risk tab of /admin/commissions.
export interface FlaggedReferrerRow {
  userId: string;
  userName: string;
  userEmail: string;
  profileStatus: string;
  openFlags: number;
  highFlags: number;
}

export async function listReferrersWithOpenFlags(): Promise<FlaggedReferrerRow[]> {
  const rows = (await db
    .prepare(
      `SELECT f.user_id AS user_id, u.name AS user_name, u.email AS user_email,
              COALESCE(p.status, 'active') AS profile_status,
              COUNT(*) AS open_flags,
              SUM(CASE WHEN f.severity = 'high' THEN 1 ELSE 0 END) AS high_flags
       FROM referral_risk_flags f
       JOIN users u ON u.id = f.user_id
       LEFT JOIN referrer_profiles p ON p.user_id = f.user_id
       WHERE f.status = 'open'
       GROUP BY f.user_id
       ORDER BY high_flags DESC, open_flags DESC`
    )
    .all()) as unknown as {
    user_id: string;
    user_name: string;
    user_email: string;
    profile_status: string;
    open_flags: number;
    high_flags: number;
  }[];
  return rows.map((r) => ({
    userId: r.user_id,
    userName: r.user_name,
    userEmail: r.user_email,
    profileStatus: r.profile_status,
    openFlags: r.open_flags,
    highFlags: r.high_flags,
  }));
}
