"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { getCurrentAdmin } from "@/lib/admin";
import { findProfileById, claimProfile } from "@/db/profiles";
import {
  createClaimRequest,
  findPendingRequestForUser,
  findClaimRequestById,
  approveClaimRequest,
  rejectClaimRequest,
  rejectOtherPendingRequestsForProfile,
} from "@/db/claimRequests";
import { recordAuditLog, AUDIT_ACTIONS } from "@/db/auditLog";
import { saveUploadedFile, UploadValidationError } from "@/lib/uploads";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { getRequestContext } from "@/lib/requestContext";

export interface ActionResult {
  error?: string;
}

// Step 1-3 of the manual review workflow: the applicant submits evidence
// and the application becomes "Pending" review. Ownership is NEVER
// transferred here — only an admin approval (below) can do that.
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

  const profile = findProfileById(profileId);
  if (!profile) {
    return { error: "Profile not found." };
  }
  if (profile.claimStatus === "claimed") {
    return { error: "This profile has already been claimed." };
  }

  if (findPendingRequestForUser(user.id)) {
    return {
      error:
        "You already have a claim application pending review. You can only have one at a time.",
    };
  }

  const linkedinUrl = String(formData.get("linkedinUrl") || "").trim();
  const companyWebsite = String(formData.get("companyWebsite") || "").trim();
  const socialMediaUrl = String(formData.get("socialMediaUrl") || "").trim();
  const officialEmail = String(formData.get("officialEmail") || "").trim();
  const personalStatement = String(
    formData.get("personalStatement") || ""
  ).trim();
  const additionalNotes = String(formData.get("additionalNotes") || "").trim();

  if (!personalStatement) {
    return { error: "Please include a personal statement." };
  }
  if (!linkedinUrl && !companyWebsite && !socialMediaUrl && !officialEmail) {
    return {
      error:
        "Provide at least one piece of supporting evidence (LinkedIn, company website, social media, or official email).",
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

  const request = createClaimRequest({
    applicantUserId: user.id,
    profileId,
    linkedinUrl,
    companyWebsite,
    socialMediaUrl,
    officialEmail,
    personalStatement,
    additionalNotes,
    supportingFilePath,
  });

  const ctx = getRequestContext();
  recordAuditLog({
    actorUserId: user.id,
    action: AUDIT_ACTIONS.CLAIM_REQUEST_SUBMITTED,
    targetType: "claim_request",
    targetId: request.id,
    details: { profileId, profileName: profile.name },
    ...ctx,
  });

  revalidatePath(`/profiles/${profileId}`);
  redirect(`/profiles/${profileId}`);
}

export interface ReviewResult {
  error?: string;
}

// Steps 4-6: admin review. Approving is the ONLY path that transfers
// ownership — and it also closes out any other still-pending applications
// for the same profile, since the question is now settled.
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

  const request = findClaimRequestById(requestId);
  if (!request) {
    return { error: "Claim request not found." };
  }
  if (request.status !== "pending") {
    return { error: "This request has already been reviewed." };
  }

  const adminComments = String(formData.get("adminComments") || "").trim();
  const ctx = getRequestContext();

  if (decision === "approve") {
    approveClaimRequest({
      id: requestId,
      reviewedBy: admin.id,
      adminComments,
    });
    claimProfile(request.profileId, request.applicantUserId);
    rejectOtherPendingRequestsForProfile({
      profileId: request.profileId,
      exceptRequestId: requestId,
      reviewedBy: admin.id,
    });
    recordAuditLog({
      actorUserId: admin.id,
      action: AUDIT_ACTIONS.CLAIM_APPROVED,
      targetType: "claim_request",
      targetId: requestId,
      details: {
        profileId: request.profileId,
        applicantUserId: request.applicantUserId,
        adminComments,
      },
      ...ctx,
    });
  } else {
    rejectClaimRequest({
      id: requestId,
      reviewedBy: admin.id,
      adminComments,
    });
    recordAuditLog({
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
