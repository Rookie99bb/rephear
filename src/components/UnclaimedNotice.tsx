import Link from "next/link";
import InviteNomineeButton from "@/components/InviteNomineeButton";

export default function UnclaimedNotice({
  profileId,
  loggedIn,
  pendingForThisProfile,
  pendingElsewhere,
}: {
  profileId: string;
  loggedIn: boolean;
  pendingForThisProfile: boolean;
  pendingElsewhere: boolean;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-900">
        🟡 Unclaimed Profile
      </p>
      <p className="mt-1 text-sm text-amber-800">
        This nominee hasn&apos;t claimed their profile yet.
      </p>
      <p className="text-sm text-amber-800">
        Your Reputation Credits are safely reserved until this profile is
        claimed.
      </p>
      <div className="mt-3 flex flex-wrap items-start gap-3">
        <InviteNomineeButton profileId={profileId} />
        {!loggedIn && (
          <p className="text-xs text-amber-800">
            <Link href="/login" className="font-medium underline">
              Log in
            </Link>{" "}
            to claim this profile.
          </p>
        )}
        {loggedIn && pendingForThisProfile && (
          <p className="rounded-lg border border-amber-900 px-3 py-1.5 text-xs font-medium text-amber-900">
            Your claim application is pending review
          </p>
        )}
        {loggedIn && !pendingForThisProfile && pendingElsewhere && (
          <p className="text-xs text-amber-800">
            You have another claim application pending review — only one at
            a time is allowed.
          </p>
        )}
        {loggedIn && !pendingForThisProfile && !pendingElsewhere && (
          <Link
            href={`/profiles/${profileId}/claim`}
            className="rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
          >
            Claim Profile
          </Link>
        )}
      </div>
    </div>
  );
}
