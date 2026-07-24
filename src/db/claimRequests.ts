import { db, rawClient } from "./client";
import { newId } from "@/lib/id";
import type { ClaimRequest, ClaimRequestStatus, ClaimType } from "@/lib/types";
import { AUDIT_ACTIONS } from "./auditLog";

interface ClaimRequestRow {
  id: string;
  applicant_user_id: string;
  profile_id: string;
  status: string;
  claim_type: string;
  full_legal_name: string;
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
  info_requested: string;
  info_requested_at: string | null;
  info_requested_by: string | null;
}

function toClaimRequest(row: ClaimRequestRow): ClaimRequest {
  return {
    id: row.id,
    applicantUserId: row.applicant_user_id,
    profileId: row.profile_id,
    status: row.status as ClaimRequestStatus,
    claimType: row.claim_type as ClaimType,
    fullLegalName: row.full_legal_name,
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
    infoRequested: row.info_requested,
    infoRequestedAt: row.info_requested_at,
    infoRequestedBy: row.info_requested_by,
  };
}

// A user may have at most one OPEN claim application at any time (across
// all Profiles) — matches the product's "one person, one Public Profile"
// identity model. "Open" now covers both PENDING and MORE_INFO_REQUIRED:
// a claim waiting on the applicant to respond still counts as active, so
// they can't just abandon it and start claiming a different Profile.
export async function findActiveRequestForUser(
  applicantUserId: string
): Promise<ClaimRequest | null> {
  const row = (await db
    .prepare(
      `SELECT * FROM claim_requests WHERE applicant_user_id = ? AND status IN ('pending', 'more_info_required')`
    )
    .get(applicantUserId)) as unknown as ClaimRequestRow | undefined;
  return row ? toClaimRequest(row) : null;
}

// submittedAt is an optional override used only by the demo seed data.
export async function createClaimRequest(params: {
  applicantUserId: string;
  profileId: string;
  claimType: ClaimType;
  fullLegalName: string;
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
      (id, applicant_user_id, profile_id, claim_type, full_legal_name, linkedin_url, company_website, social_media_url,
       official_email, personal_statement, additional_notes, supporting_file_path, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`
    )
    .run(
      id,
      params.applicantUserId,
      params.profileId,
      params.claimType,
      params.fullLegalName.trim(),
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

// How many OTHER open (pending/more_info_required) applications exist for
// this Profile right now — a "competing claims" risk signal for admins
// (see src/db/claimRisk.ts), not used to auto-decide anything.
export async function countOtherOpenRequestsForProfile(
  profileId: string,
  exceptRequestId: string
): Promise<number> {
  const row = (await db
    .prepare(
      `SELECT COUNT(*) AS c FROM claim_requests
       WHERE profile_id = ? AND id != ? AND status IN ('pending', 'more_info_required')`
    )
    .get(profileId, exceptRequestId)) as unknown as { c: number };
  return row.c;
}

// Requests are NEVER deleted. Reject only ever updates status + review
// metadata, preserving the full history permanently. Can be called from
// either 'pending' or 'more_info_required' — an admin doesn't have to
// wait for a response before rejecting outright if the evidence already
// on file is enough to decide.
export async function rejectClaimRequest(params: {
  id: string;
  reviewedBy: string;
  adminComments: string;
  reviewedAt?: string;
}): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE claim_requests
     SET status = 'rejected', reviewed_at = COALESCE(?, datetime('now')), reviewed_by = ?, admin_comments = ?
     WHERE id = ? AND status IN ('pending', 'more_info_required')`
    )
    .run(params.reviewedAt ?? null, params.reviewedBy, params.adminComments.trim(), params.id);
  return result.changes > 0;
}

// Admin asks the claimant for something specific before deciding. Moves
// the claim to MORE_INFO_REQUIRED; the claimant's existing evidence is
// left untouched (only a resubmission via submitAdditionalEvidence below
// changes it). Callable from 'pending' (the normal case) or again from
// 'more_info_required' (asking for something further after a first
// round) — never from a terminal state.
export async function requestMoreInfoOnClaim(params: {
  id: string;
  infoRequested: string;
  requestedBy: string;
}): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE claim_requests
       SET status = 'more_info_required', info_requested = ?,
           info_requested_at = datetime('now'), info_requested_by = ?
       WHERE id = ? AND status IN ('pending', 'more_info_required')`
    )
    .run(params.infoRequested.trim(), params.requestedBy, params.id);
  return result.changes > 0;
}

// Claimant responds to a MORE_INFO_REQUIRED request. IDOR-safe by
// construction: the caller (submitAdditionalInfoAction) must pass the
// SAME applicantUserId used to originally submit the claim (never a
// client-supplied value), and this WHERE clause double-checks it at the
// database layer too. Only ever succeeds from 'more_info_required',
// returning the claim to 'pending' for another review pass. The caller
// is responsible for snapshotting the pre-update row into an audit log
// entry first — this function only ever overwrites the "current
// evidence" columns, it never deletes anything; the full before/after is
// preserved in audit_logs (see CLAIM_ADDITIONAL_INFO_SUBMITTED).
export async function submitAdditionalEvidence(params: {
  id: string;
  applicantUserId: string;
  linkedinUrl: string;
  companyWebsite: string;
  socialMediaUrl: string;
  officialEmail: string;
  personalStatement: string;
  additionalNotes: string;
  supportingFilePath: string | null;
}): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE claim_requests
       SET status = 'pending',
           linkedin_url = ?, company_website = ?, social_media_url = ?,
           official_email = ?, personal_statement = ?, additional_notes = ?,
           supporting_file_path = COALESCE(?, supporting_file_path)
       WHERE id = ? AND applicant_user_id = ? AND status = 'more_info_required'`
    )
    .run(
      params.linkedinUrl.trim(),
      params.companyWebsite.trim(),
      params.socialMediaUrl.trim(),
      params.officialEmail.trim(),
      params.personalStatement.trim(),
      params.additionalNotes.trim(),
      params.supportingFilePath,
      params.id,
      params.applicantUserId
    );
  return result.changes > 0;
}

export interface OwnershipTransferResult {
  ok: boolean;
  error?: string;
}

// The one place ownership of a Profile can ever change hands. Runs as a
// single interactive database transaction (see @libsql/client's
// Client.transaction()) so that "claim approved" and "ownership
// transferred" can never disagree with each other, even under a genuine
// race (two admins approving two different competing claims for the
// same Profile at nearly the same instant, or a double-submitted
// approval click):
//   1. Claim must currently be open (pending/more_info_required) — if
//      another request already resolved it first, this step affects 0
//      rows and the whole transaction is rolled back before touching
//      the Profile at all.
//   2. Profile must not already be claimed — if a *different* approved
//      claim already claimed it first (the narrow competing-claims race
//      this function exists to close), this step affects 0 rows and the
//      transaction is rolled back, undoing step 1 too. No partial state
//      is ever left behind: either both the claim and the Profile
//      update together, or neither does.
//   3. Any other still-open claims for the same Profile are closed
//      (status='closed', distinct from 'rejected' — they weren't
//      rejected for cause, they're just moot now).
//   4. Both the CLAIM_APPROVED and PROFILE_OWNERSHIP_TRANSFERRED audit
//      log entries are written inside the same transaction, so the audit
//      trail and the actual data change can never disagree either.
// isFounderOverride tags the audit entries so the report/story of what
// happened is honest even though the mechanics (steps 1-3) are
// identical either way.
export async function approveClaimAndTransferOwnership(params: {
  requestId: string;
  profileId: string;
  claimantUserId: string;
  reviewerUserId: string;
  adminComments: string;
  isFounderOverride: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  // Optional overrides used only by the demo seed data, so backdated
  // demo claims still show a realistic historical review/claimed date
  // instead of "just now". Real reviews (from src/lib/actions/claimRequests.ts)
  // never pass these, so they always get the true current timestamp.
  reviewedAtOverride?: string;
  claimedAtOverride?: string;
}): Promise<OwnershipTransferResult> {
  // Ensures schema migrations have already run (the guarded `db` wrapper
  // does this on first use; rawClient below talks to the database
  // directly and skips that check, so we go through `db` at least once
  // first — see the equivalent comment in src/db/schema.ts).
  await db.prepare("SELECT 1").get();

  const tx = await rawClient.transaction("write");
  try {
    const claimUpdate = await tx.execute({
      sql: `UPDATE claim_requests
            SET status = 'approved', reviewed_at = COALESCE(?, datetime('now')), reviewed_by = ?, admin_comments = ?
            WHERE id = ? AND status IN ('pending', 'more_info_required')`,
      args: [params.reviewedAtOverride ?? null, params.reviewerUserId, params.adminComments.trim(), params.requestId],
    });
    if (Number(claimUpdate.rowsAffected) === 0) {
      await tx.rollback();
      return { ok: false, error: "This claim has already been reviewed." };
    }

    const profileUpdate = await tx.execute({
      sql: `UPDATE profiles
            SET claim_status = 'claimed', claimed_by = ?, claimed_at = COALESCE(?, datetime('now'))
            WHERE id = ? AND claim_status != 'claimed'`,
      args: [params.claimantUserId, params.claimedAtOverride ?? null, params.profileId],
    });
    if (Number(profileUpdate.rowsAffected) === 0) {
      await tx.rollback();
      return {
        ok: false,
        error: "This profile was already claimed by a different application.",
      };
    }

    await tx.execute({
      sql: `UPDATE claim_requests
            SET status = 'closed', reviewed_at = datetime('now'), reviewed_by = ?,
                admin_comments = 'Automatically closed: this profile was claimed via a different application.'
            WHERE profile_id = ? AND status IN ('pending', 'more_info_required') AND id != ?`,
      args: [params.reviewerUserId, params.profileId, params.requestId],
    });

    await tx.execute({
      sql: `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, details, ip_address, user_agent)
            VALUES (?, ?, ?, 'claim_request', ?, ?, ?, ?)`,
      args: [
        newId(),
        params.reviewerUserId,
        AUDIT_ACTIONS.CLAIM_APPROVED,
        params.requestId,
        JSON.stringify({
          profileId: params.profileId,
          applicantUserId: params.claimantUserId,
          adminComments: params.adminComments.trim(),
          founderOverride: params.isFounderOverride,
        }),
        params.ipAddress,
        params.userAgent,
      ],
    });
    await tx.execute({
      sql: `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, details, ip_address, user_agent)
            VALUES (?, ?, ?, 'profile', ?, ?, ?, ?)`,
      args: [
        newId(),
        params.reviewerUserId,
        AUDIT_ACTIONS.PROFILE_OWNERSHIP_TRANSFERRED,
        params.profileId,
        JSON.stringify({
          claimId: params.requestId,
          newOwnerUserId: params.claimantUserId,
          founderOverride: params.isFounderOverride,
        }),
        params.ipAddress,
        params.userAgent,
      ],
    });

    await tx.commit();
    return { ok: true };
  } catch (err) {
    try {
      await tx.rollback();
    } catch {
      // Already closed/rolled back — nothing further to do.
    }
    throw err;
  } finally {
    tx.close();
  }
}

