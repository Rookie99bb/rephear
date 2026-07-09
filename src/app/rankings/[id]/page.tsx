import { notFound } from "next/navigation";
import { findRankingById } from "@/db/rankings";
import { getMostLoved, getMostSupported } from "@/db/leaderboards";
import { likedProfileIdsForUser } from "@/db/likes";
import { getCurrentUser } from "@/lib/session";
import { isAdminEmail } from "@/lib/admin";
import AddNomineeForm from "@/components/AddNomineeForm";
import LeaderboardTable from "@/components/LeaderboardTable";
import CheckoutBanner from "@/components/CheckoutBanner";
import { Suspense } from "react";

export default async function RankingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const ranking = findRankingById(params.id);
  if (!ranking) notFound();

  const user = await getCurrentUser();

  // Hidden (spam) and soft-deleted Rankings are invisible to everyone
  // except admins.
  if ((ranking.isHidden || ranking.deletedAt) && !isAdminEmail(user?.email)) {
    notFound();
  }
  const mostLoved = getMostLoved(ranking.id);
  const mostSupported = getMostSupported(ranking.id);
  const likedProfileIds = user
    ? likedProfileIdsForUser(ranking.id, user.id)
    : new Set<string>();

  return (
    <div>
      <Suspense fallback={null}>
        <CheckoutBanner />
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
          icon="🏆"
          entries={mostLoved}
          emphasis="likes"
          rankingId={ranking.id}
          likedProfileIds={likedProfileIds}
          loggedIn={!!user}
        />
        <LeaderboardTable
          title="Most Supported"
          icon="🪙"
          entries={mostSupported}
          emphasis="credits"
          rankingId={ranking.id}
          likedProfileIds={likedProfileIds}
          loggedIn={!!user}
        />
      </div>
    </div>
  );
}
