import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { findRankingById } from "@/db/rankings";
import { getLeaderboards } from "@/db/leaderboards";
import { likeCountsForUser } from "@/db/likes";
import { shareCountsForUser } from "@/db/shares";
import { getCurrentUser } from "@/lib/session";
import { isAdminEmail } from "@/lib/admin";
import RankingCoverHero from "@/components/RankingCoverHero";
import {
  getRankingLocationLabel,
  getRankingLocationPhrase,
} from "@/lib/rankingDisplay";
import { getMovement } from "@/db/rankingSnapshots";
import { isFollowing } from "@/db/follows";
import {
  getRoadToTop3,
  getTop3Challengers,
  getCommunityStory,
} from "@/db/journeyTimeline";
import AddNomineeForm from "@/components/AddNomineeForm";
import LeaderboardTable from "@/components/LeaderboardTable";
import FollowButton from "@/components/FollowButton";
import CheckoutBanner from "@/components/CheckoutBanner";
import RaffleBanner from "@/components/RaffleBanner";
import { RoadToTop3Section, CommunitySection } from "@/components/RoadToTop3";
import { Suspense } from "react";

// Per-page title/OG so a shared Ranking link unfurls with the Ranking's
// own name and city instead of the site-wide default "RepHear" (see the
// optimization review — shared links previously showed no useful
// preview). Hidden/soft-deleted Rankings fall back to the parent
// generateMetadata behavior (notFound() further down still applies for
// the page render itself; metadata generation just needs to not throw).
export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const ranking = await findRankingById(params.id);
  if (!ranking || ranking.isHidden || ranking.deletedAt) {
    return { title: "Ranking not found" };
  }
  const place = getRankingLocationPhrase(ranking);
  const title = `${ranking.title} — ${place}`;
  const description =
    ranking.description ||
    `See who's leading "${ranking.title}" in ${place} on RepHear.`;
  return {
    title,
    description,
    alternates: { canonical: `/rankings/${ranking.id}` },
    openGraph: { title, description, url: `/rankings/${ranking.id}` },
    twitter: { title, description },
  };
}

export default async function RankingDetailPage({
params,
}: {
params: { id: string };
}) {
const ranking = await findRankingById(params.id);
if (!ranking) notFound();

const user = await getCurrentUser();

if ((ranking.isHidden || ranking.deletedAt) && !isAdminEmail(user?.email)) {
notFound();
}
// One stats query feeds both boards (was two identical heavy queries).
const { mostLoved, mostSupported } = await getLeaderboards(ranking.id);
const likeCounts = user
? await likeCountsForUser(ranking.id, user.id)
: new Map<string, number>();
const shareCounts = user
? await shareCountsForUser(ranking.id, user.id)
: new Map<string, number>();
const engagement = new Map(
[...mostLoved, ...mostSupported].map((entry) => [
entry.profile.id,
{
likeCount: likeCounts.get(entry.profile.id) ?? 0,
allowedLikes: 1 + (shareCounts.get(entry.profile.id) ?? 0),
},
])
);
// Phase 3 (§23/§26): snapshot-backed movement for both boards. Empty
// maps when fewer than two daily snapshots exist — LeaderboardTable
// then renders no arrows (never inferred).
const [lovedMovement, supportedMovement] = await Promise.all([
getMovement(ranking.id, "loved"),
getMovement(ranking.id, "supported"),
]);
// Phase 3 (§19): follow-this-ranking state for the signed-in user.
const following = user
? await isFollowing(user.id, "ranking", ranking.id)
: false;
// Phase 5.4 (§17): Road to Top 3 + Community story modules. All
// event-driven — no milestone rows, no modules.
const [roads, challengers, community] = await Promise.all([
getRoadToTop3(ranking.id),
getTop3Challengers(ranking.id),
getCommunityStory(ranking.id),
]);

return (
<div>
<Suspense fallback={null}>
<CheckoutBanner />
</Suspense>
<Suspense fallback={null}>
<RaffleBanner rankingId={ranking.id} />
</Suspense>
<RankingCoverHero ranking={ranking} />
<p className="text-[10px] font-medium uppercase tracking-wide text-subtle">
{getRankingLocationLabel(ranking)}
</p>
<h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
{ranking.title}
</h1>
{ranking.description && (
<p className="mt-2 max-w-2xl text-sm text-subtle">
{ranking.description}
</p>
)}
<div className="mt-3">
<FollowButton
targetType="ranking"
targetId={ranking.id}
targetName={ranking.title}
initialFollowing={following}
loggedIn={!!user}
/>
</div>

{user && (
<div className="mt-8 rounded-xl border border-border p-5">
<h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-subtle">
Add Nominee
</h2>
<AddNomineeForm rankingId={ranking.id} />
</div>
)}

<div className="mt-10 flex flex-col gap-10">
<LeaderboardTable
title="Most Loved"
subtitle="Ranked by Likes"
icon="🏆"
entries={mostLoved}
emphasis="likes"
rankingId={ranking.id}
city={ranking.city}
country={ranking.country}
engagement={engagement}
loggedIn={!!user}
eagerFirst={3}
movement={lovedMovement}
/>
<LeaderboardTable
title="Most Supported"
subtitle="Ranked by Reputation Credits"
icon="🪙"
entries={mostSupported}
emphasis="credits"
rankingId={ranking.id}
city={ranking.city}
country={ranking.country}
engagement={engagement}
loggedIn={!!user}
movement={supportedMovement}
/>
</div>

{/* Phase 5.4 (§17): story modules — event-driven, counts only. */}
<RoadToTop3Section roads={roads} />
<CommunitySection
totalBackers={community.totalBackers}
milestones={community.milestones}
challengers={challengers}
/>
</div>
);
}
