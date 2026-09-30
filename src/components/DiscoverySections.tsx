import Link from "next/link";
import {
  getRisingRankings,
  getNewRankings,
  getUnderratedNominees,
} from "@/db/discovery";
import type { RankingCardStats } from "@/db/rankings";
import { listCategories } from "@/db/categories";
import type { RankingBadge } from "@/lib/rankingDisplay";
import RankingCard from "@/components/RankingCard";

// Phase 3 (§22): discovery surfaces on the /rankings browse page.
// All sections are data-backed or hidden — an empty result renders
// nothing, never placeholder content.
export default async function DiscoverySections({
  badgeFor,
  stats,
}: {
  badgeFor: (rankingId: string) => RankingBadge | undefined;
  stats: Record<string, RankingCardStats>;
}) {
  const [rising, fresh, underrated, categories] = await Promise.all([
    getRisingRankings(6),
    getNewRankings(6),
    getUnderratedNominees(6),
    listCategories(),
  ]);
  const slugById = new Map(categories.map((c) => [c.id, c.slug]));
  const slugFor = (categoryId: string | null | undefined) =>
    categoryId ? slugById.get(categoryId) : undefined;
  if (
    rising.length === 0 &&
    fresh.length === 0 &&
    underrated.length === 0
  ) {
    return null;
  }
  return (
    <div className="mb-10 flex flex-col gap-8">
      {rising.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-subtle">
            🔥 Rising this week
          </h2>
          <p className="mb-3 text-xs text-subtle">
            Rankings with the most likes and backing activity in the last 7
            days.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {rising.map(({ ranking }) => (
              <RankingCard
                key={ranking.id}
                ranking={ranking}
                badge={badgeFor(ranking.id) ?? "rising"}
                categorySlug={slugFor(ranking.categoryId)}
                likeCount={stats[ranking.id]?.likeCount ?? 0}
                nomineeCount={stats[ranking.id]?.nomineeCount ?? 0}
              />
            ))}
          </div>
        </section>
      )}
      {fresh.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-subtle">
            ✨ New to RepHear
          </h2>
          <p className="mb-3 text-xs text-subtle">
            Rankings started in the last 30 days — get in early.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fresh.map((ranking) => (
              <RankingCard
                key={ranking.id}
                ranking={ranking}
                badge={badgeFor(ranking.id) ?? "new"}
                categorySlug={slugFor(ranking.categoryId)}
                likeCount={stats[ranking.id]?.likeCount ?? 0}
                nomineeCount={stats[ranking.id]?.nomineeCount ?? 0}
              />
            ))}
          </div>
        </section>
      )}
      {underrated.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-subtle">
            💎 Underrated gems
          </h2>
          <p className="mb-3 text-xs text-subtle">
            Loved by many, backed by few — under 1,000 Support Credits.
          </p>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {underrated.map((u) => (
              <li
                key={`${u.rankingId}:${u.profile.id}`}
                className="rounded-xl border border-border p-4"
              >
                <Link
                  href={`/rankings/${u.rankingId}`}
                  className="font-medium hover:underline"
                >
                  {u.profile.name}
                </Link>
                <p className="mt-0.5 text-xs text-subtle">
                  {u.likeCount.toLocaleString()} likes ·{" "}
                  {u.reputationCredits.toLocaleString()} credits in{" "}
                  {u.rankingTitle}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
