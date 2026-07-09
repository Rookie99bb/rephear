import Link from "next/link";
import InviteNomineeButton from "@/components/InviteNomineeButton";

// The only three states a normal user ever sees for a profile's
// verification. No admin/moderation detail (review status, comments,
// who's reviewing, etc.) is ever shown here — that lives only in the
// Admin Panel, which normal users cannot reach.
export default function ProfileVerificationStatus({
  profileId,
  claimStatus,
  loggedIn,
  hasPendingRequestForThisProfile,
  hasPendingRequestElsewhere,
}: {
  profileId: string;
  claimStatus: "claimed" | "unclaimed";
  loggedIn: boolean;
  hasPendingRequestForThisProfile: boolean;
  hasPendingRequestElsewhere: boolean;
}) {
  if (claimStatus === "claimed") {
    return (
      <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
        ✓ Verified
      </p>
    );
  }

  if (hasPendingRequestForThisProfile) {
    return (
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-900">Unclaimed</p>
        <p className="mt-2 inline-block rounded-lg border border-amber-900 px-3 py-1.5 text-xs font-medium text-amber-900">
          Verification in progress
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-900">Unclaimed</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <InviteNomineeButton profileId={profileId} />
        {!loggedIn && (
          <p className="text-xs text-amber-800">
            <Link href="/login" className="font-medium underline">
              Log in
            </Link>{" "}
            to claim this profile.
          </p>
        )}
        {loggedIn && hasPendingRequestElsewhere && (
          <p className="text-xs text-amber-800">
            You already have a claim pending review elsewhere — only one at
            a time is allowed.
          </p>
        )}
        {loggedIn && !hasPendingRequestElsewhere && (
          <Link
            href={`/profiles/${profileId}/claim`}
            className="rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
          >
            Claim this profile
          </Link>
        )}
      </div>
    </div>
  );
}
