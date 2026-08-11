"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { getCurrentAdmin } from "@/lib/admin";
import { isFounderEmail } from "@/lib/adminEmails";
import { findUserById, countAdmins } from "@/db/users";
import { findProfileById } from "@/db/profiles";
import {
  createClaimRequest,
  findActiveRequestForUser,
  findClaimRequestById,
  rejectClaimRequest,
  requestMoreInfoOnClaim,
  submitAdditionalEvidence,
  approveClaimAndTransferOwnership,
} from "@/db/claimRequests";
import { recordAuditLog, AUDIT_ACTIONS } from "@/db/auditLog";
import { saveUploadedFile, UploadValidationError } from "@/lib/uploads";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { getRequestContext } from "@/lib/requestContext";
import { sendEmail } from "@/lib/email";
import { claimMoreInfoRequestedEmail } from "@/emails/claimMoreInfoRequested";
import type { ClaimType } from "@/lib/types";

export interface ActionResult {
  error?: string;
}

const CLAIM_TYPES: ClaimType[] = ["self", "representative", "organization"];

function parseClaimType(value: FormDataEntryValue | null): ClaimType {
  const v = String(value || "self");
  return (CLAIM_TYPES as string[]).includes(v) ? (v as ClaimType) : "self";
}

function readEvidenceFields(formData: FormData) {
  return {
    linkedinUrl: String(formData.get("linkedinUrl") || "").trim(),
    companyWebsite: String(formData.get("companyWebsite") || "").trim(),
    socialMediaUrl: String(formData.get("socialMediaUrl") || "").trim(),
    officialEmail: String(formData.get("officialEmail") || "").trim(),
    personalStatement: String(formData.get("personalStatement") || "").trim(),
    additionalNotes: String(formData.get("additionalNotes") || "").trim(),
  };
}

function hasAnyEvidence(fields: {
  linkedinUrl: string;
  companyWebsite: string;
  socialMediaUrl: string;
  officialEmail: string;
}): boolean {
  return !!(
    fields.linkedinUrl ||
    fields.companyWebsite ||
    fields.socialMediaUrl ||
    fields.officialEmail
  );
}

// Step 1-3 of the manual review workflow: the applicant submits evidence
// and the application becomes PENDING review. Ownership is NEVER
// transferred here — only an admin approval (or the tightly-scoped
// Founder Override, see below) can ever do that.
export async function submitClaimRequestAction(
  profileId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "You must be logged in to claim a profile." };
  }

  if (!checkRateLimit(`claimProfile:${user.id}`, RATE_LIMITS.claimProfile)) {
    return {
      error: "You've submitted too many claim applications today. Please try again tomorrow.",
    };
  }

  const profile = await findProfileById(profileId);
  if (!profile) {
    return { error: "Profile not found." };
  }
  if (profile.claimStatus === "claimed") {
    return { error: "This profile has already been claimed." };
  }

  if (await findActiveRequestForUser(user.id)) {
    return {
      error:
        "You already have a claim application in progress. You can only have one at a time.",
    };
  }

  const claimType = parseClaimType(formData.get("claimType"));
  const fullLegalName = String(formData.get("fullLegalName") || "").trim();
  const evidence = readEvidenceFields(formData);

  if (!fullLegalName) {
    return { error: "Please provide your full legal name." };
  }
  if (!evidence.personalStatement) {
    return { error: "Please include a reason for claiming this profile." };
  }
  if (!hasAnyEvidence(evidence)) {
    return {
      error:
        "Provide at least one piece of supporting evidence (LinkedIn, official website, social media, or official email).",
    };
  }

  let supportingFilePath: string | null = null;
  const file = formData.get("supportingFile");
  if (file instanceof File && file.size > 0) {
    try {
      supportingFilePath = await saveUploadedFile(file);
    } catch (err) {
      if (err instanceof UploadValidationError) {
        return { error: err.message };
      }
      throw err;
    }
  }

  const request = await createClaimRequest({
    applicantUserId: user.id,
    profileId,
    claimType,
    fullLegalName,
    ...evidence,
    supportingFilePath,
  });

  const ctx = getRequestContext();
  await recordAuditLog({
    actorUserId: user.id,
    action: AUDIT_ACTIONS.CLAIM_REQUEST_SUBMITTED,
    targetType: "claim_request",
    targetId: request.id,
    details: { profileId, profileName: profile.name, claimType },
    ...ctx,
  });

  revalidatePath(`/profiles/${profileId}`);
  redirect(`/profiles/${profileId}`);
}

// Step: claimant responds to a MORE_INFO_REQUIRED application with
// updated evidence. IDOR-safe: identity comes from the session
// (getCurrentUser()), never from a client-supplied userId, and
// submitAdditionalEvidence() re-checks applicant_user_id in its own
// WHERE clause as a second, database-level guard against a user passing
// someone else's requestId.
export async function submitAdditionalInfoAction(
  requestId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "You must be logged in." };
  }

  const request = await findClaimRequestById(requestId);
  if (!request) {
    return { error: "Claim request not found." };
  }
  if (request.applicantUserId !== user.id) {
    return { error: "Forbidden." };
  }
  if (request.status !== "more_info_required") {
    return { error: "This claim isn't currently awaiting additional information." };
  }

  const evidence = readEvidenceFields(formData);
  if (!evidence.personalStatement) {
    return { error: "Please include a reason for claiming this profile." };
  }
  if (!hasAnyEvidence(evidence)) {
    return {
      error:
        "Provide at least one piece of supporting evidence (LinkedIn, official website, social media, or official email).",
    };
  }

  let supportingFilePath: string | null = null;
  const file = formData.get("supportingFile");
  if (file instanceof File && file.size > 0) {
    try {
      supportingFilePath = await saveUploadedFile(file);
    } catch (err) {
      if (err instanceof UploadValidationError) {
        return { error: err.message };
      }
      throw err;
    }
  }

  // Snapshot the evidence as it stood BEFORE this update, alongside the
  // admin's original information request and the new evidence being
  // submitted now — all three preserved permanently in the (append-only,
  // trigger-enforced) audit log, even though the live claim_requests row
  // below only ever stores the current/latest evidence for the admin to
  // review against.
  const ctx = getRequestContext();
  await recordAuditLog({
    actorUserId: user.id,
    action: AUDIT_ACTIONS.CLAIM_ADDITIONAL_INFO_SUBMITTED,
    targetType: "claim_request",
    targetId: requestId,
    details: {
      profileId: request.profileId,
      infoThatWasRequested: request.infoRequested,
      previousEvidence: {
        linkedinUrl: request.linkedinUrl,
        companyWebsite: request.companyWebsite,
        socialMediaUrl: request.socialMediaUrl,
        officialEmail: request.officialEmail,
        personalStatement: request.personalStatement,
        additionalNotes: request.additionalNotes,
        supportingFilePath: request.supportingFilePath,
      },
      newEvidence: { ...evidence, supportingFilePath },
    },
    ...ctx,
  });

  const ok = await submitAdditionalEvidence({
    id: requestId,
    applicantUserId: user.id,
    ...evidence,
    supportingFilePath,
  });
  if (!ok) {
    return { error: "This claim is no longer awaiting additional information." };
  }

  revalidatePath(`/profiles/${request.profileId}`);
  revalidatePath(`/profiles/${request.profileId}/claim`);
  revalidatePath("/admin/claims");
  return {};
}

export interface ReviewResult {
  error?: string;
}

// Server-side guard shared by every normal review action below. This is
// the actual security boundary — the UI also hides/disables these
// actions for a claimant reviewing their own claim, but that's cosmetic;
// this check is what actually stops the request, including a direct API
// call or a replayed/forged form submission. Comparing immutable internal
// user IDs (never emails, which can be changed or spoofed in transit).
function isSelfReview(claimantUserId: string, reviewerUserId: string): boolean {
  return claimantUserId === reviewerUserId;
}

// Steps 4-6 (normal path): admin approves or rejects. Approving is the
// ONLY path that transfers ownership (via approveClaimAndTransferOwnership,
// which does so atomically) — and it also closes out any other still-open
// applications for the same Profile, since the question is now settled.
export async function reviewClaimRequestAction(
  requestId: string,
  decision: "approve" | "reject",
  _prev: ReviewResult,
  formData: FormData
): Promise<ReviewResult> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return { error: "Forbidden." };
  }

  const request = await findClaimRequestById(requestId);
  if (!request) {
    return { error: "Claim request not found." };
  }
  if (request.status !== "pending" && request.status !== "more_info_required") {
    return { error: "This request has already been reviewed." };
  }
  // Critical security requirement: no user — ADMIN, SUPER_ADMIN, or any
  // future privileged role — may approve or reject their own claim
  // through this normal review path. The only way a self-submitted claim
  // can ever be approved is the separate, far more constrained
  // founderOverrideClaimAction below.
  if (isSelfReview(request.applicantUserId, admin.id)) {
    return {
      error:
        "You can't review your own claim. Ask another administrator to review it, or use the Founder Override if you are the sole administrator.",
    };
  }

  const adminComments = String(formData.get("adminComments") || "").trim();
  const ctx = getRequestContext();

  if (decision === "approve") {
    const result = await approveClaimAndTransferOwnership({
      requestId,
      profileId: request.profileId,
      claimantUserId: request.applicantUserId,
      reviewerUserId: admin.id,
      adminComments,
      isFounderOverride: false,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    if (!result.ok) {
      return { error: result.error };
    }
  } else {
    const ok = await rejectClaimRequest({
      id: requestId,
      reviewedBy: admin.id,
      adminComments,
    });
    if (!ok) {
      return { error: "This request has already been reviewed." };
    }
    await recordAuditLog({
      actorUserId: admin.id,
      action: AUDIT_ACTIONS.CLAIM_REJECTED,
      targetType: "claim_request",
      targetId: requestId,
      details: {
        profileId: request.profileId,
        applicantUserId: request.applicantUserId,
        adminComments,
      },
      ...ctx,
    });
  }

  revalidatePath("/admin/claims");
  revalidatePath("/admin/audit");
  revalidatePath(`/profiles/${request.profileId}`);
  return {};
}

// Admin asks for specific additional evidence instead of deciding yet.
// Same self-review guard as approve/reject — asking yourself for more
// information is still reviewing your own claim.
export async function requestMoreInfoAction(
  requestId: string,
  _prev: ReviewResult,
  formData: FormData
): Promise<ReviewResult> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return { error: "Forbidden." };
  }

  const request = await findClaimRequestById(requestId);
  if (!request) {
    return { error: "Claim request not found." };
  }
  if (request.status !== "pending" && request.status !== "more_info_required") {
    return { error: "This request has already been reviewed." };
  }
  if (isSelfReview(request.applicantUserId, admin.id)) {
    return { error: "You can't review your own claim." };
  }

  const items = formData.getAll("infoItems").map((v) => String(v));
  const otherNote = String(formData.get("otherNote") || "").trim();
  const parts = [...items];
  if (otherNote) parts.push(`Other: ${otherNote}`);
  const infoRequested = parts.join("; ");

  if (!infoRequested) {
    return { error: "Specify what additional information is needed." };
  }

  const ctx = getRequestContext();
  await recordAuditLog({
    actorUserId: admin.id,
    action: AUDIT_ACTIONS.CLAIM_MORE_INFO_REQUESTED,
    targetType: "claim_request",
    targetId: requestId,
    details: {
      profileId: request.profileId,
      infoRequested,
      currentEvidenceSnapshot: {
        linkedinUrl: request.linkedinUrl,
        companyWebsite: request.companyWebsite,
        socialMediaUrl: request.socialMediaUrl,
        officialEmail: request.officialEmail,
        personalStatement: request.personalStatement,
        additionalNotes: request.additionalNotes,
        supportingFilePath: request.supportingFilePath,
      },
    },
    ...ctx,
  });

  const ok = await requestMoreInfoOnClaim({
    id: requestId,
    infoRequested,
    requestedBy: admin.id,
  });
  if (!ok) {
    return { error: "This request has already been reviewed." };
  }

  // Notify the applicant by email — otherwise their only way to learn
  // their application is stalled is to happen to revisit the claim page.
  // Never let an email failure surface as an error on the admin's review
  // action; the review itself already succeeded above.
  try {
    const [applicant, profile] = await Promise.all([
      findUserById(request.applicantUserId),
      findProfileById(request.profileId),
    ]);
    if (applicant && profile) {
      const { subject, html } = claimMoreInfoRequestedEmail({
        applicantName: applicant.name,
        profileName: profile.name,
        profileId: request.profileId,
        infoRequested,
      });
      await sendEmail({ to: applicant.email, subject, html });
    }
  } catch (err) {
    console.error("[requestMoreInfoAction] Failed to send notification email:", err);
  }

  revalidatePath("/admin/claims");
  revalidatePath(`/profiles/${request.profileId}`);
  return {};
}

export interface FounderOverrideResult {
  error?: string;
}

// Founder Override: a tightly-scoped, explicitly-logged escape hatch for
// the single-administrator MVP scenario where a legitimate founder claim
// would otherwise be permanently unreviewable (nobody else exists who
// could ever approve it). This is NOT a general self-approval bypass:
//
//   - Only usable by the one email configured as FOUNDER_EMAIL (see
//     src/lib/adminEmails.ts) — unset that env var and this entire action
//     always fails, regardless of who calls it.
//   - Only usable while there is exactly one administrator account. The
//     moment a second admin exists, this returns an error telling the
//     founder to ask that other admin to review it instead — exactly the
//     normal path, no override needed or allowed anymore.
//   - Only usable on the founder's OWN claim (self-review is the entire
//     reason this path exists — it is not a shortcut for reviewing
//     someone else's claim faster).
//   - Requires the founder to re-enter their current account password
//     (checked fresh against the stored hash — this is not the login
//     session, it's a fresh proof of "it's really you, right now").
//   - Requires a mandatory written reason.
//   - Requires the claim to actually have verification evidence on file
//     (refuses an override on a bare, evidence-free application).
//   - Still runs through the exact same atomic ownership-transfer
//     transaction as a normal approval (approveClaimAndTransferOwnership)
//     — the override changes WHO is allowed to trigger it and what extra
//     conditions must hold, never the mechanics of the transfer itself.
//   - Always logs a dedicated FOUNDER_CLAIM_OVERRIDE audit entry (in
//     addition to the normal CLAIM_APPROVED/PROFILE_OWNERSHIP_TRANSFERRED
//     entries), so this is never silently indistinguishable from an
//     ordinary independent review.
export async function founderOverrideClaimAction(
  requestId: string,
  _prev: FounderOverrideResult,
  formData: FormData
): Promise<FounderOverrideResult> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return { error: "Forbidden." };
  }
  if (!isFounderEmail(admin.email)) {
    return { error: "The Founder Override is not available to your account." };
  }

  const adminCount = await countAdmins();
  if (adminCount > 1) {
    return {
      error:
        "There is more than one administrator. Ask another administrator to review this claim instead of using the Founder Override.",
    };
  }

  const request = await findClaimRequestById(requestId);
  if (!request) {
    return { error: "Claim request not found." };
  }
  if (request.status !== "pending" && request.status !== "more_info_required") {
    return { error: "This request has already been reviewed." };
  }
  if (request.applicantUserId !== admin.id) {
    return {
      error:
        "The Founder Override can only be used on your own claim. Review other applicants' claims normally.",
    };
  }

  const hasEvidence = hasAnyEvidence({
    linkedinUrl: request.linkedinUrl,
    companyWebsite: request.companyWebsite,
    socialMediaUrl: request.socialMediaUrl,
    officialEmail: request.officialEmail,
  }) || !!request.supportingFilePath;
  if (!hasEvidence) {
    return {
      error:
        "This claim has no verification evidence on file. The Founder Override requires evidence to be present.",
    };
  }

  const reason = String(formData.get("overrideReason") || "").trim();
  if (!reason) {
    return { error: "A written override reason is required." };
  }

  const confirmPassword = String(formData.get("confirmPassword") || "");
  if (!confirmPassword) {
    return { error: "Re-enter your password to confirm." };
  }
  // Fresh re-authentication: verified against a fresh DB read of the
  // founder's own password hash, not anything cached on the session.
  const freshAdmin = await findUserById(admin.id);
  if (!freshAdmin) {
    return { error: "Forbidden." };
  }
  const passwordOk = await bcrypt.compare(confirmPassword, freshAdmin.passwordHash);
  if (!passwordOk) {
    return { error: "Incorrect password." };
  }

  const ctx = getRequestContext();

  const result = await approveClaimAndTransferOwnership({
    requestId,
    profileId: request.profileId,
    claimantUserId: request.applicantUserId,
    reviewerUserId: admin.id,
    adminComments: `Founder Override: ${reason}`,
    isFounderOverride: true,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
  if (!result.ok) {
    return { error: result.error };
  }

  // Dedicated audit action, distinct from and in addition to the
  // CLAIM_APPROVED / PROFILE_OWNERSHIP_TRANSFERRED entries that
  // approveClaimAndTransferOwnership already wrote — this is what makes
  // "a self-approval exception happened here" impossible to miss when
  // reviewing the audit log later.
  await recordAuditLog({
    actorUserId: admin.id,
    action: AUDIT_ACTIONS.FOUNDER_CLAIM_OVERRIDE,
    targetType: "claim_request",
    targetId: requestId,
    details: {
      claimantUserId: request.applicantUserId,
      reviewerUserId: admin.id,
      profileId: request.profileId,
      claimId: requestId,
      reason,
      evidencePresent: true,
    },
    ...ctx,
  });

  revalidatePath("/admin/claims");
  revalidatePath("/admin/audit");
  revalidatePath(`/profiles/${request.profileId}`);
  return {};
}
