import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { findRankingById } from "@/db/rankings";
import { findProfileById } from "@/db/profiles";
import { getCurrentUser } from "@/lib/session";
import { CREDIT_PACKAGES } from "@/lib/creditPackages";
import Avatar from "@/components/Avatar";
import SupportPackages from "@/components/SupportPackages";

export default async function SupportPage({
  params,
}: {
  params: { id: string; profileId: string };
}) {
  const ranking = findRankingById(params.id);
  const profile = findProfileById(params.profileId);
  if (!ranking || !profile) notFound();

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login`);
  }

  return (
    <div className="mx-auto max-w-md">
      <Link
        href={`/rankings/${ranking.id}`}
        className="text-sm text-subtle hover:text-ink"
      >
        ← Back to {ranking.title}
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <Avatar name={profile.name} photoUrl={profile.photoUrl} size={48} />
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink">
            Support {profile.name}
          </h1>
          <p className="text-sm text-subtle">in {ranking.title}</p>
        </div>
      </div>

      <div className="mt-6">
        <SupportPackages
          rankingId={ranking.id}
          profileId={profile.id}
          packages={CREDIT_PACKAGES}
        />
      </div>
    </div>
  );
}
