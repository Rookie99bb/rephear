import Link from "next/link";
import { listClaimRequestsByStatus } from "@/db/claimRequests";
import { getClaimRiskSignals } from "@/db/claimRisk";
import { listAuditLogs } from "@/db/auditLog";
import { findUserById, countAdmins } from "@/db/users";
import { findProfileById } from "@/db/profiles";
import { getCurrentAdmin } from "@/lib/admin";
import { isFounderEmail } from "@/lib/adminEmails";
import type { ClaimRequestStatus } from "@/lib/types";
import Avatar from "@/components/Avatar";
import AdminClaimReviewForm from "@/components/AdminClaimReviewForm";
import FounderOverrideForm from "@/components/FounderOverrideForm";

const TABS: { label: string; status: ClaimRequestStatus }[] = [
  { label: "Pending", status: "pending" },
  { label: "More Info Requested", status: "more_info_required" },
  { label: "Approved", status: "approved" },
  { label: "Rejected", status: "rejected" },
  { label: "Closed", status: "closed" },
];

const RISK_STYLES: Record<string, string> = {
  LOW: "bg-emerald-100 text-emerald-800",
  MEDIUM: "bg-amber-100 text-amber-900",
  HIGH: "bg-red-100 text-red-800",
};

const CLAIM_TYPE_LABELS: Record<string, string> = {
  self: "I am this person",
  representative: "I officially represent this person",
  organization: "I manage this organization",
};

export default async function AdminClaimsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const validStatuses = TABS.map((t) => t.status) as string[];
  const status: ClaimRequestStatus = validStatuses.includes(
    searchParams.status || ""
  )
    ? (searchParams.status as ClaimRequestStatus)
    : "pending";

  const admin = await getCurrentAdmin();
  if (!admin) return null; // layout-level guard already redirects; this satisfies types.

  const [requests, adminCount] = await Promise.all([
    listClaimRequestsByStatus(status),
    countAdmins(),
  ]);
  const viewerIsFounder = isFounderEmail(admin.email);
  const singleAdmin = adminCount <= 1;

  // Resolve each request's applicant/profile/risk/history up front —
  // .map() inside the JSX below can't itself be async.
  const rows = [];
  for (const req of requests) {
    const applicant = await findUserById(req.applicantUserId);
    const profile = await findProfileById(req.profileId);
    if (!profile) continue;
    const risk = await getClaimRiskSignals(req);
    const history = await listAuditLogs({ targetId: req.id, limit: 20 });
    rows.push({ req, applicant, profile, risk, history });
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.status}
            href={`/admin/claims?status=${tab.status}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              status === tab.status
                ? "bg-ink text-white"
                : "border border-border text-subtle hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-subtle">No claim requests in this state.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map(({ req, applicant, profile, risk, history }) => {
            const isSelfClaim = req.applicantUserId === admin.id;
            const canReviewNormally = !isSelfClaim;
            const founderOverrideEligible =
              isSelfClaim &&
              viewerIsFounder &&
              singleAdmin &&
              (req.status === "pending" || req.status === "more_info_required");
            const isOpen = req.status === "pending" || req.status === "more_info_required";

            return (
              <li
                key={req.id}
                className="rounded-xl border border-amber-200 bg-amber-50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={profile.name} photoUrl={profile.photoUrl} size={32} />
                    <div>
                      <p className="text-sm font-medium text-ink">
                        Claim for{" "}
                        <Link href={`/profiles/${profile.id}`} className="underline">
                          {profile.name}
                        </Link>
                      </p>
                      <p className="text-xs text-subtle">
                        Applicant: {applicant?.name ?? "Unknown"} (
                        {applicant?.email ?? "unknown"})
                      </p>
                      <p className="text-xs text-subtle">
                        Applicant user ID:{" "}
                        <span className="font-mono">{req.applicantUserId}</span>
                      </p>
                      {applicant && (
                        <p className="text-xs text-subtle">
                          Account created:{" "}
                          {new Date(applicant.createdAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${RISK_STYLES[risk.level]}`}
                      title="Decision support only — never used to auto-approve or auto-reject."
                    >
                      Risk: {risk.level}
                    </span>
                    <p className="text-xs text-subtle">
                      {new Date(req.submittedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-amber-900">
                  <span className="rounded-full border border-amber-300 px-2 py-0.5">
                    {CLAIM_TYPE_LABELS[req.claimType] ?? req.claimType}
                  </span>
                  {risk.competingOpenClaims > 0 && (
                    <span className="rounded-full border border-amber-300 px-2 py-0.5">
                      {risk.competingOpenClaims} competing open claim
                      {risk.competingOpenClaims > 1 ? "s" : ""}
                    </span>
                  )}
                  {risk.profileAlreadyClaimed && (
                    <span className="rounded-full border border-amber-300 px-2 py-0.5">
                      Profile already claimed
                    </span>
                  )}
                  <span className="rounded-full border border-amber-300 px-2 py-0.5">
                    {risk.profileLikeCount} Likes · {risk.profileSupportCredits} Credits received
                  </span>
                  {risk.accountAgeDays !== null && (
                    <span className="rounded-full border border-amber-300 px-2 py-0.5">
                      Account age: {risk.accountAgeDays}d
                    </span>
                  )}
                  {risk.officialEmailLooksInstitutional && (
                    <span className="rounded-full border border-amber-300 px-2 py-0.5">
                      Institutional email domain
                    </span>
                  )}
                </div>

                <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-amber-900 sm:grid-cols-2">
                  <Evidence label="Full legal name" value={req.fullLegalName} />
                  <Evidence label="LinkedIn" value={req.linkedinUrl} isLink />
                  <Evidence label="Company website" value={req.companyWebsite} isLink />
                  <Evidence label="Social media" value={req.socialMediaUrl} isLink />
                  <Evidence label="Official email" value={req.officialEmail} />
                </dl>

                <p className="mt-2 text-sm text-amber-900">
                  <span className="font-medium">Reason for claiming:</span>{" "}
                  {req.personalStatement}
                </p>
                {req.additionalNotes && (
                  <p className="mt-1 text-sm text-amber-900">
                    <span className="font-medium">Notes:</span> {req.additionalNotes}
                  </p>
                )}
                {req.supportingFilePath && (
                  <p className="mt-1 text-sm">
                    <a
                      href={`/api/uploads/${req.supportingFilePath}`}
                      className="font-medium text-ink underline"
                    >
                      Download supporting file
                    </a>
                  </p>
                )}

                {req.infoRequested && (
                  <p className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-900">
                    <span className="font-medium">Information requested from applicant:</span>{" "}
                    {req.infoRequested}
                  </p>
                )}

                {history.length > 0 && (
                  <details className="mt-2 text-xs text-amber-900">
                    <summary className="cursor-pointer font-medium">
                      Previous review activity ({history.length})
                    </summary>
                    <ul className="mt-1 flex flex-col gap-1 border-l border-amber-300 pl-3">
                      {history.map((h) => (
                        <li key={h.id}>
                          {new Date(h.createdAt).toLocaleString()} —{" "}
                          <span className="font-mono">{h.action}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {req.status !== "pending" &&
                  req.status !== "more_info_required" && (
                    <p className="mt-2 text-xs text-amber-900">
                      Reviewed {req.reviewedAt} — {req.status}
                      {req.adminComments && <> — &ldquo;{req.adminComments}&rdquo;</>}
                    </p>
                  )}

                {isOpen && canReviewNormally && (
                  <AdminClaimReviewForm requestId={req.id} />
                )}

                {isOpen && isSelfClaim && !founderOverrideEligible && (
                  <p className="mt-3 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-xs font-medium text-amber-900">
                    You cannot review your own claim.
                    {viewerIsFounder && !singleAdmin && (
                      <>
                        {" "}
                        The Founder Override is unavailable because there is more than
                        one administrator — ask another administrator to review this
                        claim.
                      </>
                    )}
                  </p>
                )}

                {isOpen && founderOverrideEligible && (
                  <FounderOverrideForm requestId={req.id} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Claim evidence links (LinkedIn/company website/social media) are
// free-text submitted by the applicant (see submitClaimRequestAction in
// src/lib/actions/claimRequests.ts, which only .trim()s them) and were
// being rendered directly as an <a href>. React does not sanitize href
// schemes, so a value like "javascript:alert(document.cookie)" would
// render as a clickable link that executes script in the admin's
// session when clicked — a stored XSS reachable only by an admin
// visiting /admin/claims. Standard fix: only ever render as a clickable
// link when the value is a genuine http(s) URL; otherwise show the
// submitted text as plain, non-clickable text so admins can still see
// exactly what was submitted.
function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function Evidence({
  label,
  value,
  isLink,
}: {
  label: string;
  value: string;
  isLink?: boolean;
}) {
  if (!value) return null;
  const safeLink = isLink && isSafeHttpUrl(value);
  return (
    <div>
      <dt className="font-medium">{label}</dt>
      <dd>
        {safeLink ? (
          <a href={value} className="underline" target="_blank" rel="noreferrer">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
