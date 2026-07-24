import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { findProfileById } from "@/db/profiles";
import { findActiveRequestForUser } from "@/db/claimRequests";
import { getCurrentUser } from "@/lib/session";
import Avatar from "@/components/Avatar";
import ClaimApplicationForm from "@/components/ClaimApplicationForm";
import AdditionalInfoForm from "@/components/AdditionalInfoForm";

export default async function ClaimProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const profile = await findProfileById(params.id);
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

  const active = await findActiveRequestForUser(user.id);

  if (active && active.profileId === profile.id && active.status === "more_info_required") {
    return (
      <div className="mx-auto max-w-lg">
        <div className="flex items-center gap-3">
          <Avatar name={profile.name} photoUrl={profile.photoUrl} size={40} />
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-ink">
              Claim {profile.name}
            </h1>
            <p className="text-sm text-subtle">
              An administrator needs a bit more information before this application can
              be decided.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">Information requested:</p>
          <p className="mt-1 text-sm text-amber-900">{active.infoRequested}</p>
        </div>

        <div className="mt-6">
          <AdditionalInfoForm request={active} />
        </div>
      </div>
    );
  }

  if (active) {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="text-sm font-medium text-amber-900">
          {active.profileId === profile.id
            ? "Verification in progress"
            : "You already have a claim application in progress elsewhere — only one at a time is allowed."}
        </p>
        <Link
          href={`/profiles/${active.profileId}`}
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
