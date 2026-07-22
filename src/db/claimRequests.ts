import { db } from "./client";
import { newId } from "@/lib/id";
import type { ClaimRequest, ClaimRequestStatus } from "@/lib/types";

interface ClaimRequestRow {
  id: string;
  applicant_user_id: string;
  profile_id: string;
  status: string;
  linkedin_url: string;
  company_website: string;
  social_media_url: string;
  official_email: string;
  personal_statement: string;
  additional_notes: string;
  supporting_file_path: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  admin_comments: string;
}

function toClaimRequest(row: ClaimRequestRow): ClaimRequest {
  return {
    id: row.id,
    applicantUserId: row.applicant_user_id,
    profileId: row.profile_id,
    status: row.status as ClaimRequestStatus,
    linkedinUrl: row.linkedin_url,
    companyWebsite: row.company_website,
    socialMediaUrl: row.social_media_url,
    officialEmail: row.official_email,
    personalStatement: row.personal_statement,
    additionalNotes: row.additional_notes,
    supportingFilePath: row.supporting_file_path,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    adminComments: row.admin_comments,
  };
}

// A user may have at most one Pending claim application at any time
// (across all Profiles) — matches the product's "one person, one Public
// Profile" identity model.
export async function findPendingRequestForUser(
  applicantUserId: string
): Promise<ClaimRequest | null> {
  const row = (await db
    .prepare(
      "SELECT * FROM claim_requests WHERE applicant_user_id = ? AND status = 'pending'"
    )
    .get(applicantUserId)) as unknown as ClaimRequestRow | undefined;
  return row ? toClaimRequest(row) : null;
}

// submittedAt is an optional override used only by the demo seed data.
export async function createClaimRequest(params: {
  applicantUserId: string;
  profileId: string;
  linkedinUrl: string;
  companyWebsite: string;
  socialMediaUrl: string;
  officialEmail: string;
  personalStatement: string;
  additionalNotes: string;
  supportingFilePath: string | null;
  submittedAt?: string;
}): Promise<ClaimRequest> {
  const id = newId();
  await db
    .prepare(
      `INSERT INTO claim_requests
      (id, applicant_user_id, profile_id, linkedin_url, company_website, social_media_url,
       official_email, personal_statement, additional_notes, supporting_file_path, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`
    )
    .run(
      id,
      params.applicantUserId,
      params.profileId,
      params.linkedinUrl.trim(),
      params.companyWebsite.trim(),
      params.socialMediaUrl.trim(),
      params.officialEmail.trim(),
      params.personalStatement.trim(),
      params.additionalNotes.trim(),
      params.supportingFilePath,
      params.submittedAt ?? null
    );
  return (await findClaimRequestById(id))!;
}

export async function findClaimRequestById(id: string): Promise<ClaimRequest | null> {
  const row = (await db
    .prepare("SELECT * FROM claim_requests WHERE id = ?")
    .get(id)) as unknown as ClaimRequestRow | undefined;
  return row ? toClaimRequest(row) : null;
}

export async function listClaimRequestsByStatus(
  status: ClaimRequestStatus
): Promise<ClaimRequest[]> {
  const rows = (await db
    .prepare(
      "SELECT * FROM claim_requests WHERE status = ? ORDER BY submitted_at DESC"
    )
    .all(status)) as unknown as ClaimRequestRow[];
  return rows.map(toClaimRequest);
}

// Requests are NEVER deleted. Approve/reject only ever update status +
// review metadata, preserving the full history permanently.
// reviewedAt is an optional override used only by the demo seed data.
export async function approveClaimRequest(params: {
  id: string;
  reviewedBy: string;
  adminComments: string;
  reviewedAt?: string;
}): Promise<void> {
  await db
    .prepare(
      `UPDATE claim_requests
     SET status = 'approved', reviewed_at = COALESCE(?, datetime('now')), reviewed_by = ?, admin_comments = ?
     WHERE id = ? AND status = 'pending'`
    )
    .run(params.reviewedAt ?? null, params.reviewedBy, params.adminComments.trim(), params.id);
}

export async function rejectClaimRequest(params: {
  id: string;
  reviewedBy: string;
  adminComments: string;
  reviewedAt?: string;
}): Promise<void> {
  await db
    .prepare(
      `UPDATE claim_requests
     SET status = 'rejected', reviewed_at = COALESCE(?, datetime('now')), reviewed_by = ?, admin_comments = ?
     WHERE id = ? AND status = 'pending'`
    )
    .run(params.reviewedAt ?? null, params.reviewedBy, params.adminComments.trim(), params.id);
}

// When one application for a Profile is approved, any other still-pending
// applications for that same Profile are auto-rejected (the Profile is now
// claimed, so they're moot) — bookkeeping, not an auto-approval.
export async function rejectOtherPendingRequestsForProfile(params: {
  profileId: string;
  exceptRequestId: string;
  reviewedBy: string;
}): Promise<void> {
  await db
    .prepare(
      `UPDATE claim_requests
     SET status = 'rejected', reviewed_at = datetime('now'), reviewed_by = ?,
         admin_comments = 'Automatically closed: this profile was claimed via a different application.'
     WHERE profile_id = ? AND status = 'pending' AND id != ?`
    )
    .run(params.reviewedBy, params.profileId, params.exceptRequestId);
}
