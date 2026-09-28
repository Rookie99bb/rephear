"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAdmin } from "@/lib/admin";
import {
  setReferrerStatus,
  addRiskFlag,
  resolveRiskFlag,
  approvePayout,
  markPayoutPaid,
  rejectPayout,
  findPayoutById,
  type RiskFlagSeverity,
} from "@/db/referrerCommissions";
import { recordAuditLog, AUDIT_ACTIONS } from "@/db/auditLog";
import { getRequestContext } from "@/lib/requestContext";

export interface ReferrerAdminActionResult {
  error?: string;
  success?: boolean;
}

async function audit(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, unknown>
) {
  const ctx = getRequestContext();
  await recordAuditLog({
    actorUserId: adminId,
    action,
    targetType,
    targetId,
    details,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
}

export async function setReferrerStatusAction(
  userId: string,
  status: "active" | "paused",
  reason: string
): Promise<ReferrerAdminActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Admin access required." };
  await setReferrerStatus(userId, status);
  await audit(
    admin.id,
    status === "paused" ? AUDIT_ACTIONS.REFERRER_PAUSED : AUDIT_ACTIONS.REFERRER_RESUMED,
    "referrer_profile",
    userId,
    { reason }
  );
  revalidatePath("/admin/commissions");
  return { success: true };
}

export async function addRiskFlagAction(
  _prev: ReferrerAdminActionResult,
  formData: FormData
): Promise<ReferrerAdminActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Admin access required." };
  const userId = String(formData.get("userId") || "").trim();
  const type = String(formData.get("type") || "").trim();
  const severity = String(formData.get("severity") || "medium") as RiskFlagSeverity;
  const evidenceRef = String(formData.get("evidenceRef") || "").trim();
  if (!userId || !type) return { error: "User and flag type are required." };
  if (!["low", "medium", "high"].includes(severity)) {
    return { error: "Invalid severity." };
  }
  const flag = await addRiskFlag({
    userId,
    type,
    severity,
    evidenceRef,
    createdBy: admin.id,
  });
  await audit(admin.id, AUDIT_ACTIONS.RISK_FLAG_ADDED, "referral_risk_flag", flag.id, {
    userId,
    type,
    severity,
    evidenceRef,
  });
  revalidatePath("/admin/commissions");
  return { success: true };
}

export async function resolveRiskFlagAction(
  flagId: string,
  resolution: "cleared" | "confirmed"
): Promise<ReferrerAdminActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Admin access required." };
  const ok = await resolveRiskFlag(flagId, resolution);
  if (!ok) return { error: "This flag was already resolved." };
  await audit(admin.id, AUDIT_ACTIONS.RISK_FLAG_RESOLVED, "referral_risk_flag", flagId, {
    resolution,
  });
  revalidatePath("/admin/commissions");
  return { success: true };
}

// decision: 'approve' (requested -> approved), 'paid' (approved -> paid,
// money already sent externally), 'reject' (requested/approved -> rejected).
export async function reviewPayoutAction(
  payoutId: string,
  decision: "approve" | "paid" | "reject",
  _prev: ReferrerAdminActionResult,
  formData: FormData
): Promise<ReferrerAdminActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Admin access required." };

  const payout = await findPayoutById(payoutId);
  if (!payout) return { error: "This payout request no longer exists." };
  if (payout.userId === admin.id) {
    return { error: "You cannot review your own payout request." };
  }

  const adminNotes = String(formData.get("adminNotes") || "").trim();
  const providerRef = String(formData.get("providerRef") || "").trim();

  let ok = false;
  let action = "";
  try {
    if (decision === "approve") {
      if (payout.status !== "requested") {
        return { error: "This request has already been reviewed." };
      }
      ok = await approvePayout(payoutId, admin.id, adminNotes);
      action = AUDIT_ACTIONS.PAYOUT_APPROVED;
    } else if (decision === "paid") {
      if (payout.status !== "approved") {
        return { error: "Only approved payouts can be marked paid." };
      }
      if (!providerRef) {
        return { error: "Enter the external transfer reference first." };
      }
      ok = await markPayoutPaid(payoutId, admin.id, providerRef, adminNotes);
      action = AUDIT_ACTIONS.PAYOUT_PAID;
    } else {
      ok = await rejectPayout(payoutId, admin.id, adminNotes);
      action = AUDIT_ACTIONS.PAYOUT_REJECTED;
    }
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Something went wrong — try again.",
    };
  }

  if (!ok) {
    return { error: "This request was already handled by someone else." };
  }
  await audit(admin.id, action, "referral_payout", payoutId, {
    userId: payout.userId,
    amountCents: payout.amountCents,
    adminNotes,
    providerRef: providerRef || undefined,
  });
  revalidatePath("/admin/commissions");
  return { success: true };
}
