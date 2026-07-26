"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { getCurrentAdmin } from "@/lib/admin";
import { findProfileById, getProfileStats } from "@/db/profiles";
import {
  createRedemptionRequest,
  findRedemptionById,
  reservedCreditsForProfile,
  markRedemptionPaid,
  rejectRedemption,
} from "@/db/redemptions";
import { recordAuditLog, AUDIT_ACTIONS } from "@/db/auditLog";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { getRequestContext } from "@/lib/requestContext";
import {
  computeRedemptionAmounts,
  MIN_REDEMPTION_CREDITS,
  REDEMPTION_FEE_RATE,
} from "@/lib/redemption";

export interface RedemptionActionResult {
  error?: string;
  success?: boolean;
}

// Only the profile's current claimed owner may cash out that profile's
// Reputation Credits — this is intentionally the SAME identity check as
// the rest of the claim system (compare against a fresh DB read of
// claimed_by, never anything client-supplied). Money only ever flows out
// to the person RepHear has already verified owns this Public Profile.
export async function requestRedemptionAction(
  profileId: string,
  _prev: RedemptionActionResult,
  formData: FormData
): Promise<RedemptionActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "You must be logged in to redeem Support." };
  }

  const profile = await findProfileById(profileId);
  if (!profile) {
    return { error: "This profile no longer exists." };
  }
  if (profile.claimStatus !== "claimed" || profile.claimedBy !== user.id) {
    return { error: "Only this profile's verified owner can redeem its Support." };
  }

  if (!checkRateLimit(`redeemCredits:${user.id}`, RATE_LIMITS.redeemCredits)) {
    return { error: "Too many redemption requests — please try again later." };
  }

  const creditsRaw = String(formData.get("credits") || "").trim();
  const credits = Number.parseInt(creditsRaw, 10);
  const payoutContact = String(formData.get("payoutContact") || "").trim();

  if (!Number.isFinite(credits) || credits <= 0 || !Number.isInteger(credits)) {
    return { error: "Enter a whole number of Credits to redeem." };
  }
  if (credits < MIN_REDEMPTION_CREDITS) {
    return {
      error: `You must redeem at least ${MIN_REDEMPTION_CREDITS} Credits at a time.`,
    };
  }
  if (!payoutContact) {
    return { error: "Enter where we should send your payout (e.g. a PayPal email)." };
  }

  const stats = await getProfileStats(profileId);
  const reserved = await reservedCreditsForProfile(profileId);
  const available = stats.totalReputationCredits - reserved;

  if (credits > available) {
    return {
      error: `You can redeem at most ${available} Credits right now (the rest is already paid out or awaiting review).`,
    };
  }

  const amounts = computeRedemptionAmounts(credits);
  const redemption = await createRedemptionRequest({
    profileId,
    requestedBy: user.id,
    credits,
    grossAmountCents: amounts.grossAmountCents,
    feeCents: amounts.feeCents,
    netAmountCents: amounts.netAmountCents,
    feeRate: REDEMPTION_FEE_RATE,
    payoutContact,
  });

  const ctx = getRequestContext();
  await recordAuditLog({
    actorUserId: user.id,
    action: AUDIT_ACTIONS.REDEMPTION_REQUESTED,
    targetType: "credit_redemption",
    targetId: redemption.id,
    details: {
      profileId,
      credits,
      grossAmountCents: amounts.grossAmountCents,
      feeCents: amounts.feeCents,
      netAmountCents: amounts.netAmountCents,
    },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  revalidatePath(`/profiles/${profileId}/redeem`);
  revalidatePath(`/profiles/${profileId}`);
  return { success: true };
}

// Same self-review principle as claim approvals (see
// src/lib/actions/claimRequests.ts isSelfReview): an admin can never mark
// their own redemption request paid or rejected, even though as an admin
// they'd otherwise have access to this action. Comparing against a fresh
// DB read of the redemption's requested_by, not anything client-supplied.
export async function reviewRedemptionAction(
  redemptionId: string,
  decision: "paid" | "reject",
  _prev: RedemptionActionResult,
  formData: FormData
): Promise<RedemptionActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return { error: "Admin access required." };
  }

  const redemption = await findRedemptionById(redemptionId);
  if (!redemption) {
    return { error: "This redemption request no longer exists." };
  }
  if (redemption.requestedBy === admin.id) {
    return { error: "You cannot review your own redemption request." };
  }
  if (redemption.status !== "pending") {
    return { error: "This request has already been reviewed." };
  }

  const adminNotes = String(formData.get("adminNotes") || "").trim();

  const ok =
    decision === "paid"
      ? await markRedemptionPaid(redemptionId, admin.id, adminNotes)
      : await rejectRedemption(redemptionId, admin.id, adminNotes);

  if (!ok) {
    return { error: "This request was already reviewed by someone else." };
  }

  const ctx = getRequestContext();
  await recordAuditLog({
    actorUserId: admin.id,
    action:
      decision === "paid"
        ? AUDIT_ACTIONS.REDEMPTION_PAID
        : AUDIT_ACTIONS.REDEMPTION_REJECTED,
    targetType: "credit_redemption",
    targetId: redemptionId,
    details: { profileId: redemption.profileId, adminNotes },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  revalidatePath("/admin/redemptions");
  return { success: true };
}
