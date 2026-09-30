import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { findProfileByShareToken } from "@/db/profileShare";
import { findRankingById } from "@/db/rankings";
import { getMostLoved } from "@/db/leaderboards";
import { likeCountsForUser } from "@/db/likes";
import { shareCountsForUser } from "@/db/shares";
import { getCurrentUser } from "@/lib/session";
import Avatar from "@/components/Avatar";
import NomineeLandingActions from "@/components/NomineeLandingActions";

// Nominee share landing page: rephear.com/n/TOKEN
// Every nominee's personal link + QR code points here. Focused layout:
// photo, name, ranking title, then the two actions — free Like and
// Credits support. No nav chrome needed beyond a link to the full ranking.
export async function generateMetadata({
  params,
}: {
  params: { token: string };
}): Promise<Metadata> {
  const profile = await findProfileByShareToken(params.token);
  if (!profile) return { title: "Not found" };
  const ranking = await findRankingById(profile.rankingId);
  const title = `${profile.name} — ${ranking?.title ?? "RepHear"}`;
  const description =
    profile.bio || `Vote for ${profile.name} on RepHear.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: profile.photoUrl ? [{ url: profile.photoUrl }] : undefined,
    },
    twitter: { title, description },
  };
}

export default async function NomineeSharePage({
  params,
}: {
  params: { token: string };
}) {
  const profile = await findProfileByShareToken(params.token);
  if (!profile) notFound();

  const ranking = await findRankingById(profile.rankingId);
  if (!ranking || ranking.isHidden || ranking.deletedAt) notFound();

  const user = await getCurrentUser();
  const mostLoved = await getMostLoved(ranking.id);
  const entry = mostLoved.find((e) => e.profile.id === profile.id);
  const totalLikes = entry?.likeCount ?? 0;

  const userLikeCounts = user
    ? await likeCountsForUser(ranking.id, user.id)
    : new Map<string, number>();
  const userShareCounts = user
    ? await shareCountsForUser(ranking.id, user.id)
    : new Map<string, number>();
  const myLikes = userLikeCounts.get(profile.id) ?? 0;
  const allowedLikes = 1 + (userShareCounts.get(profile.id) ?? 0);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-12 text-center">
      <Avatar name={profile.name} photoUrl={profile.photoUrl} size={112} />
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink">
        {profile.name}
      </h1>
      <p className="mt-1 text-sm font-medium text-subtle">{ranking.title}</p>
      {profile.region && (
        <p className="mt-1 text-xs uppercase tracking-wide text-subtle">
          {profile.region}
        </p>
      )}
      {profile.bio && (
        <p className="mt-3 text-sm text-subtle">{profile.bio}</p>
      )}

      <p className="mt-6 text-sm text-subtle">
        <span className="text-lg font-semibold text-ink">{totalLikes}</span>{" "}
        likes so far
      </p>

      <div className="mt-6 w-full">
        <NomineeLandingActions
          rankingId={ranking.id}
          profileId={profile.id}
          profileName={profile.name}
          initialMyLikes={myLikes}
          initialAllowedLikes={allowedLikes}
          loggedIn={!!user}
        />
      </div>

      {!user && (
        <p className="mt-4 text-xs text-subtle">
          <Link href="/login" className="font-medium text-ink underline">
            Log in
          </Link>{" "}
          to like and support {profile.name}.
        </p>
      )}

      <Link
        href={`/rankings/${ranking.id}`}
        className="mt-8 text-sm font-medium text-ink hover:opacity-80"
      >
        View the full ranking →
      </Link>
      <p className="mt-2 text-xs text-subtle">
        Powered by <span className="font-semibold">RepHear</span>
      </p>
    </div>
  );
}
