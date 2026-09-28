"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { acceptTerms, requestPayout } from "@/db/referrerCommissions";
import { recordAuditLog, AUDIT_ACTIONS } from "@/db/auditLog";
import { getRequestContext } from "@/lib/requestContext";

export interface ReferrerActionResult {
  error?: string;
  success?: boolean;
}

export async function acceptTermsAction(): Promise<ReferrerActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be logged in." };
  await acceptTerms(user.id);
  revalidatePath("/referrals");
  return { success: true };
}

export async function requestPayoutAction(
  _prev: ReferrerActionResult,
  formData: FormData
): Promise<ReferrerActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be logged in." };

  const payoutContact = String(formData.get("payoutContact") || "").trim();
  try {
    const payout = await requestPayout(user.id, payoutContact);

    const ctx = getRequestContext();
    await recordAuditLog({
      actorUserId: user.id,
      action: AUDIT_ACTIONS.PAYOUT_REQUESTED,
      targetType: "referral_payout",
      targetId: payout.id,
      details: {
        amountCents: payout.amountCents,
        currency: payout.currency,
      },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Could not submit your request.",
    };
  }

  revalidatePath("/referrals");
  revalidatePath("/referrals/payouts");
  return { success: true };
}
