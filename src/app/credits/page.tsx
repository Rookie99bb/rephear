import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getCreditsHistoryForUser } from "@/db/creditsHistory";
import { findProfilesClaimedByUser, getProfileStats, findProfileById } from "@/db/profiles";
import { findLatestClaimRequestForUser } from "@/db/claimRequests";
import type { ClaimRequest, Profile } from "@/lib/types";

// "My Reputation Credits" — a record of community Support, not a wallet.
// The underlying data is untouched (still getCreditsHistoryForUser,
// still the payments + credit_transactions ledger, still the same
// numbers) — this file only controls how it's *described*. RepHear
// should read as a recognition platform, so user-facing copy avoids
// financial/transactional words like "Purchase", "Purchased", "Ledger",
// and "Balance" — see history.currentBalance below, which is
// deliberately left out of the UI for the same reason (there's no
// actual spendable wallet, so showing a "balance" only confuses people
// into thinking there is one).
export default async function CreditsHistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [history, claimedProfiles] = await Promise.all([
    getCreditsHistoryForUser(user.id),
    findProfilesClaimedByUser(user.id),
  ]);

  // Only look up an application's status when the user doesn't already
  // own a claimed Profile — once claimed, the story to tell is the
  // Profile's Likes/Credits, not the (by then historical) application.
  const latestClaim =
    claimedProfiles.length === 0 ? await findLatestClaimRequestForUser(user.id) : null;
  const latestClaimProfile =
    latestClaim && ["pending", "more_info_required", "rejected"].includes(latestClaim.status)
      ? await findProfileById(latestClaim.profileId)
      : null;

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-ink">
        My Reputation Credits
      </h1>
      <p className="mt-1 text-sm text-subtle">
        See the support you&apos;ve given and the support you&apos;ve
        received.
      </p>

      <div className="mt-6 flex gap-10 border-y border-border py-5">
        <Stat label="Support Given" value={history.totalPurchased} />
        <Stat label="Support Received" value={history.totalReceived} />
      </div>

      <p className="mt-4 text-sm text-subtle">
        A Like says &ldquo;I recognize you.&rdquo; Support says &ldquo;I
        stand behind you.&rdquo;
      </p>

      {claimedProfiles.length > 0 && (
        <ClaimedProfilesSection profiles={claimedProfiles} />
      )}

      {claimedProfiles.length === 0 && latestClaimProfile && latestClaim && (
        <ClaimStatusSection claim={latestClaim} profile={latestClaimProfile} />
      )}

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-subtle">
          Your Support Activity
        </h2>
        {history.entries.length === 0 ? (
          <p className="text-sm text-subtle">No Support yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-subtle">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Nominee</th>
                  <th className="py-2 pr-4 font-medium">Ranking</th>
                  <th className="py-2 pr-4 text-right font-medium">
                    Credits
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-border/60">
                    <td className="py-2 pr-4 text-subtle">
                      {new Date(entry.date).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-4">
                      {entry.type === "purchased" ? (
                        <span className="text-ink">Support Given</span>
                      ) : (
                        <span className="text-emerald-700">
                          Support Received
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-ink">
                      {entry.profileName}
                    </td>
                    <td className="py-2 pr-4 text-subtle">
                      {entry.rankingTitle}
                    </td>
                    <td className="py-2 pr-4 text-right font-medium text-ink">
                      {entry.credits} Credits
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-sm text-subtle">Every Support matters.</p>
      </div>
    </div>
  );
}

// Shown once a claim has actually gone through — the Likes + Reputation
// Credits totals mirror exactly what NomineeStats shows on the public
// Ranking page (same getProfileStats query), just framed here as "your"
// numbers instead of a leaderboard stat.
async function ClaimedProfilesSection({ profiles }: { profiles: Profile[] }) {
  const withStats = await Promise.all(
    profiles.map(async (profile) => ({
      profile,
      stats: await getProfileStats(profile.id),
    }))
  );

  return (
    <div className="mt-8 border-b border-border pb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-subtle">
        Your Claimed Profile{withStats.length > 1 ? "s" : ""}
      </h2>
      <div className="flex flex-col gap-3">
        {withStats.map(({ profile, stats }) => (
          <Link
            key={profile.id}
            href={`/profiles/${profile.id}`}
            className="flex items-center justify-between rounded-xl border border-border px-4 py-3 transition hover:border-ink"
          >
            <span className="text-sm font-medium text-ink">{profile.name}</span>
            <span className="flex items-center gap-4 text-sm text-subtle">
              <span>
                <span className="font-semibold text-ink">{stats.totalLikes}</span> Likes
              </span>
              <span>
                <span className="font-semibold text-ink">
                  {stats.totalReputationCredits.toLocaleString()}
                </span>{" "}
                Credits Received
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// Shown while a user's claim application hasn't (or didn't) result in
// them owning a Profile yet — mirrors the three states an applicant can
// actually be in outside of "approved" (see ClaimRequestStatus): still
// under review, admin asked for more evidence, or turned down. Once
// approved, ClaimedProfilesSection above takes over and this disappears.
function ClaimStatusSection({
  claim,
  profile,
}: {
  claim: ClaimRequest;
  profile: Profile;
}) {
  const statusMeta: Record<
    "pending" | "more_info_required" | "rejected",
    { label: string; classes: string }
  > = {
    pending: {
      label: "Under review",
      classes: "border-border bg-surface text-ink",
    },
    more_info_required: {
      label: "Needs your input",
      classes: "border-amber-200 bg-amber-50 text-amber-900",
    },
    rejected: {
      label: "Not approved",
      classes: "border-red-200 bg-red-50 text-red-700",
    },
  };
  const meta = statusMeta[claim.status as keyof typeof statusMeta];
  if (!meta) return null;

  return (
    <div className="mt-8 border-b border-border pb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-subtle">
        Your Claim Application
      </h2>
      <div className={`rounded-xl border px-4 py-3 ${meta.classes}`}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">
            {profile.name} &mdash; {meta.label}
          </span>
          {claim.status === "more_info_required" && (
            <Link
              href={`/profiles/${profile.id}/claim`}
              className="shrink-0 text-sm font-medium underline"
            >
              Respond
            </Link>
          )}
        </div>
        {claim.status === "more_info_required" && claim.infoRequested && (
          <p className="mt-1 text-sm">{claim.infoRequested}</p>
        )}
        {claim.status === "rejected" && claim.adminComments && (
          <p className="mt-1 text-sm">{claim.adminComments}</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xl font-semibold tracking-tight text-ink">
        {value}
      </p>
      <p className="text-xs text-subtle">{label}</p>
    </div>
  );
}
