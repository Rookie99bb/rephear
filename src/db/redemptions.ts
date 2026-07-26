import { db } from "./client";
import { newId } from "@/lib/id";
import type { CreditRedemption, RedemptionStatus } from "@/lib/types";

interface RedemptionRow {
  id: string;
  profile_id: string;
  requested_by: string;
  credits: number;
  gross_amount_cents: number;
  fee_cents: number;
  net_amount_cents: number;
  fee_rate: number;
  payout_contact: string;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  admin_notes: string;
}

function toRedemption(row: RedemptionRow): CreditRedemption {
  return {
    id: row.id,
    profileId: row.profile_id,
    requestedBy: row.requested_by,
    credits: row.credits,
    grossAmountCents: row.gross_amount_cents,
    feeCents: row.fee_cents,
    netAmountCents: row.net_amount_cents,
    feeRate: row.fee_rate,
    payoutContact: row.payout_contact,
    status: row.status as RedemptionStatus,
    requestedAt: row.requested_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    adminNotes: row.admin_notes,
  };
}

// Credits already spoken for by a still-open or already-paid redemption
// on this profile — subtracted from total earned Credits to get what's
// still available to redeem. 'rejected'/'cancelled' requests release
// their Credits back (they're excluded here), 'pending' holds them (so
// the same Credits can't be requested twice while a request is under
// review), 'paid' permanently consumes them.
export async function reservedCreditsForProfile(profileId: string): Promise<number> {
  const row = (await db
    .prepare(
      `SELECT COALESCE(SUM(credits), 0) AS c FROM credit_redemptions
       WHERE profile_id = ? AND status IN ('pending', 'paid')`
    )
    .get(profileId)) as unknown as { c: number };
  return row.c;
}

export async function createRedemptionRequest(params: {
  profileId: string;
  requestedBy: string;
  credits: number;
  grossAmountCents: number;
  feeCents: number;
  netAmountCents: number;
  feeRate: number;
  payoutContact: string;
}): Promise<CreditRedemption> {
  const id = newId();
  await db
    .prepare(
      `INSERT INTO credit_redemptions
        (id, profile_id, requested_by, credits, gross_amount_cents, fee_cents, net_amount_cents, fee_rate, payout_contact)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      params.profileId,
      params.requestedBy,
      params.credits,
      params.grossAmountCents,
      params.feeCents,
      params.netAmountCents,
      params.feeRate,
      params.payoutContact
    );
  return (await findRedemptionById(id))!;
}

export async function findRedemptionById(id: string): Promise<CreditRedemption | null> {
  const row = (await db
    .prepare("SELECT * FROM credit_redemptions WHERE id = ?")
    .get(id)) as unknown as RedemptionRow | undefined;
  return row ? toRedemption(row) : null;
}

export async function listRedemptionsForProfile(profileId: string): Promise<CreditRedemption[]> {
  const rows = (await db
    .prepare("SELECT * FROM credit_redemptions WHERE profile_id = ? ORDER BY requested_at DESC")
    .all(profileId)) as unknown as RedemptionRow[];
  return rows.map(toRedemption);
}

export interface PendingRedemptionRow {
  redemption: CreditRedemption;
  profileName: string;
  requesterName: string;
  requesterEmail: string;
}

// Admin queue. Joins in just enough to review without extra round trips.
export async function listPendingRedemptions(): Promise<PendingRedemptionRow[]> {
  const rows = (await db
    .prepare(
      `SELECT cr.*, p.name AS profile_name, u.name AS requester_name, u.email AS requester_email
       FROM credit_redemptions cr
       JOIN profiles p ON p.id = cr.profile_id
       JOIN users u ON u.id = cr.requested_by
       WHERE cr.status = 'pending'
       ORDER BY cr.requested_at ASC`
    )
    .all()) as unknown as (RedemptionRow & {
    profile_name: string;
    requester_name: string;
    requester_email: string;
  })[];
  return rows.map((row) => ({
    redemption: toRedemption(row),
    profileName: row.profile_name,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
  }));
}

// Both review outcomes are guarded by `WHERE status = 'pending'` so a
// request can only ever be resolved once — a double-click or two admin
// tabs racing on the same request results in exactly one write taking
// effect (`changes > 0` tells the caller which).
export async function markRedemptionPaid(
  id: string,
  reviewedBy: string,
  adminNotes: string
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE credit_redemptions
       SET status = 'paid', reviewed_at = datetime('now'), reviewed_by = ?, admin_notes = ?
       WHERE id = ? AND status = 'pending'`
    )
    .run(reviewedBy, adminNotes, id);
  return result.changes > 0;
}

export async function rejectRedemption(
  id: string,
  reviewedBy: string,
  adminNotes: string
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE credit_redemptions
       SET status = 'rejected', reviewed_at = datetime('now'), reviewed_by = ?, admin_notes = ?
       WHERE id = ? AND status = 'pending'`
    )
    .run(reviewedBy, adminNotes, id);
  return result.changes > 0;
}
