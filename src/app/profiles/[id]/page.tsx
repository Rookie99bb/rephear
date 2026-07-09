import { notFound } from "next/navigation";
import Link from "next/link";
import {
  findProfileById,
  getProfileStats,
  listRankingsForProfile,
} from "@/db/profiles";
import Avatar from "@/components/Avatar";
import UnclaimedNotice from "@/components/UnclaimedNotice";
import { getCurrentUser } from "@/lib/session";
import { findPendingRequestForUser } from "@/db/claimRequests";

export default async function ProfilePage({ params }: { params: { id: string } }) {
  const profile = findProfileById(params.id);
  if (!profile) notFound();

  const stats = getProfileStats(profile.id);
  const rankings = listRankingsForProfile(profile.id);
  const user = await getCurrentUser();
  const pendingRequest = user ? findPendingRequestForUser(user.id) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-4">
        <Avatar name={profile.name} size={64} />
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            {profile.name}
          </h1>
          {profile.region && (
            <p className="text-xs uppercase tracking-wide text-subtle">
              {profile.region}
            </p>
          )}
          {profile.bio && (
            <p className="mt-1 text-sm text-subtle">{profile.bio}</p>
          )}
          {profile.claimStatus === "claimed" && (
            <p className="mt-1 text-xs font-medium text-emerald-700">
              ✓ Claimed Profile
            </p>
          )}
        </div>
      </div>

      {profile.interests.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {profile.interests.map((interest) => (
            <span
              key={interest}
              className="rounded-full border border-border px-2.5 py-1 text-xs text-subtle"
            >
              {interest}
            </span>
          ))}
        </div>
      )}

      {profile.claimStatus === "unclaimed" && (
        <div className="mt-6">
          <UnclaimedNotice
            profileId={profile.id}
            loggedIn={!!user}
            pendingForThisProfile={pendingRequest?.profileId === profile.id}
            pendingElsewhere={!!pendingRequest && pendingRequest.profileId !== profile.id}
          />
        </div>
      )}

      <div className="mt-8 flex gap-8 border-y border-border py-4">
        <Stat label="Total Likes" value={stats.totalLikes} />
        <Stat
          label="Total Reputation Credits"
          value={stats.totalReputationCredits}
        />
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-subtle">
          Participating Rankings
        </h2>
        {rankings.length === 0 ? (
          <p className="text-sm text-subtle">Not part of any Ranking yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rankings.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/rankings/${r.id}`}
                  className="block rounded-xl border border-border px-4 py-3 text-sm hover:border-ink"
                >
                  <span className="font-medium text-ink">{r.title}</span>
                  <span className="ml-2 text-subtle">
                    {r.city}, {r.country}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-lg font-semibold tracking-tight text-ink">
        {value}
      </p>
      <p className="text-xs text-subtle">{label}</p>
    </div>
  );
}
