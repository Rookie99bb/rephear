import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { findProfileById } from "@/db/profiles";
import { findPendingRequestForUser } from "@/db/claimRequests";
import { getCurrentUser } from "@/lib/session";
import Avatar from "@/components/Avatar";
import ClaimApplicationForm from "@/components/ClaimApplicationForm";

export default async function ClaimProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const profile = findProfileById(params.id);
  if (!profile) notFound();

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login`);
  }

  if (profile.claimStatus === "claimed") {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="text-sm text-subtle">
          This profile has already been claimed.
        </p>
        <Link
          href={`/profiles/${profile.id}`}
          className="mt-2 inline-block text-sm font-medium text-ink underline"
        >
          Back to profile
        </Link>
      </div>
    );
  }

  const pending = findPendingRequestForUser(user.id);
  if (pending) {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="text-sm font-medium text-amber-900">
          {pending.profileId === profile.id
            ? "Verification in progress"
            : "You already have a claim pending review elsewhere — only one at a time is allowed."}
        </p>
        <Link
          href={`/profiles/${pending.profileId}`}
          className="mt-2 inline-block text-sm font-medium text-ink underline"
        >
          View that profile
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="flex items-center gap-3">
        <Avatar name={profile.name} photoUrl={profile.photoUrl} size={40} />
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink">
            Claim {profile.name}
          </h1>
          <p className="text-sm text-subtle">
            Submit evidence that this is you. An administrator will review
            your application before ownership transfers.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <ClaimApplicationForm profileId={profile.id} />
      </div>
    </div>
  );
}
