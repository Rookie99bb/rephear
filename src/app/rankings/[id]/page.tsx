import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { findRankingById } from "@/db/rankings";
import { getMostLoved, getMostSupported } from "@/db/leaderboards";
import { likeCountsForUser } from "@/db/likes";
import { shareCountsForUser } from "@/db/shares";
import { getCurrentUser } from "@/lib/session";
import { isAdminEmail } from "@/lib/admin";
import AddNomineeForm from "@/components/AddNomineeForm";
import LeaderboardTable from "@/components/LeaderboardTable";
import CheckoutBanner from "@/components/CheckoutBanner";
import RaffleBanner from "@/components/RaffleBanner";
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
  const title = `${ranking.title} — ${ranking.city}`;
  const description =
    ranking.description ||
    `See who's leading "${ranking.title}" in ${ranking.city}, ${ranking.country} on RepHear.`;
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
const mostLoved = await getMostLoved(ranking.id);
const mostSupported = await getMostSupported(ranking.id);
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

return (
<div>
<Suspense fallback={null}>
<CheckoutBanner />
</Suspense>
<Suspense fallback={null}>
<RaffleBanner rankingId={ranking.id} />
</Suspense>
<p className="text-[10px] font-medium uppercase tracking-wide text-subtle">
{ranking.city}, {ranking.country}
</p>
<h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
{ranking.title}
</h1>
{ranking.description && (
<p className="mt-2 max-w-2xl text-sm text-subtle">
{ranking.description}
</p>
)}

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
/>
</div>
</div>
);
}
