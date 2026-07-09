import Link from "next/link";
import { listClaimRequestsByStatus } from "@/db/claimRequests";
import { findUserById } from "@/db/users";
import { findProfileById } from "@/db/profiles";
import type { ClaimRequestStatus } from "@/lib/types";
import Avatar from "@/components/Avatar";
import AdminClaimReviewForm from "@/components/AdminClaimReviewForm";

const TABS: { label: string; status: ClaimRequestStatus }[] = [
  { label: "Pending", status: "pending" },
  { label: "Approved", status: "approved" },
  { label: "Rejected", status: "rejected" },
];

export default function AdminClaimsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const status: ClaimRequestStatus =
    searchParams.status === "approved" || searchParams.status === "rejected"
      ? searchParams.status
      : "pending";

  const requests = listClaimRequestsByStatus(status);

  return (
    <div>
      <div className="mb-6 flex gap-2">
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

      {requests.length === 0 ? (
        <p className="text-sm text-subtle">No {status} claim requests.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {requests.map((req) => {
            const applicant = findUserById(req.applicantUserId);
            const profile = findProfileById(req.profileId);
            if (!profile) return null;

            return (
              <li
                key={req.id}
                className="rounded-xl border border-amber-200 bg-amber-50 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={profile.name} size={32} />
                    <div>
                      <p className="text-sm font-medium text-ink">
                        Claim for{" "}
                        <Link
                          href={`/profiles/${profile.id}`}
                          className="underline"
                        >
                          {profile.name}
                        </Link>
                      </p>
                      <p className="text-xs text-subtle">
                        Applicant: {applicant?.name ?? "Unknown"} (
                        {applicant?.email ?? "unknown"})
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-subtle">
                    {new Date(req.submittedAt).toLocaleDateString()}
                  </p>
                </div>

                <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-amber-900 sm:grid-cols-2">
                  <Evidence label="LinkedIn" value={req.linkedinUrl} isLink />
                  <Evidence
                    label="Company website"
                    value={req.companyWebsite}
                    isLink
                  />
                  <Evidence
                    label="Social media"
                    value={req.socialMediaUrl}
                    isLink
                  />
                  <Evidence label="Official email" value={req.officialEmail} />
                </dl>

                <p className="mt-2 text-sm text-amber-900">
                  <span className="font-medium">Personal statement:</span>{" "}
                  {req.personalStatement}
                </p>
                {req.additionalNotes && (
                  <p className="mt-1 text-sm text-amber-900">
                    <span className="font-medium">Notes:</span>{" "}
                    {req.additionalNotes}
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

                {req.status !== "pending" && (
                  <p className="mt-2 text-xs text-amber-900">
                    Reviewed {req.reviewedAt} — {req.status}
                    {req.adminComments && <> — &ldquo;{req.adminComments}&rdquo;</>}
                  </p>
                )}

                {req.status === "pending" && (
                  <AdminClaimReviewForm requestId={req.id} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
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
  return (
    <div>
      <dt className="font-medium">{label}</dt>
      <dd>
        {isLink ? (
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
