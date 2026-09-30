import Link from "next/link";
import CategoryHero from "./CategoryHero";
import CategoryFilterChips from "./CategoryFilterChips";
import RankingCoverCard from "./RankingCoverCard";
import {
  pickTrending,
  type CategoryRankingStat,
  type SubcategoryWithCount,
} from "@/db/categoryPage";
import type { Category } from "@/lib/types";

// Redesigned category page (?category=<slug>).
// Layout contract (per approved mockup):
//   compact hero (<= ~260px) -> search + create on one row -> filter
//   chips -> "Trending in X" (exactly 3 visual cards) -> "Explore X"
//   (4-col visual grid). No redundant "Rankings" title, no isolated
//   button rows, no text-only cards. First card row visible in the
//   first viewport.
//
// The global layout constrains <main> to max-w-5xl; this view breaks
// out to ~1280px via negative-margin math (no layout.tsx change).
export default function CategoryPageView({
  category,
  stats,
  subcategories,
  activeSub,
  activeSubName,
  query,
  following,
  loggedIn,
}: {
  category: Category;
  stats: CategoryRankingStat[];
  subcategories: SubcategoryWithCount[];
  activeSub: string | null;
  activeSubName: string | null;
  query: string | null;
  following: boolean;
  loggedIn: boolean;
}) {
  const trending = pickTrending(stats, 3);
  const trendingIds = new Set(trending.map((s) => s.ranking.id));
  const explore = [...stats]
    .filter((s) => !trendingIds.has(s.ranking.id))
    .sort((a, b) => b.totalLikes - a.totalLikes || b.nomineeCount - a.nomineeCount);

  const isTrendingView = !activeSub && !query;

  // Flat list for the "All" / subcategory / search views.
  let flatList = stats;
  let flatHeading = `All ${category.name} rankings`;
  if (query) {
    flatHeading = `Results for \u201c${query}\u201d in ${category.name}`;
  } else if (activeSub && activeSub !== "all") {
    flatList = stats.filter((s) => s.ranking.subcategoryId === activeSubId(subcategories, activeSub));
    flatHeading = activeSubName ?? category.name;
  }
  const flatSorted = [...flatList].sort(
    (a, b) => b.totalLikes - a.totalLikes || b.nomineeCount - a.nomineeCount
  );

  // Hero stats: honest aggregates over the category's public rankings.
  const totalVotes = stats.reduce((s, x) => s + x.totalLikes, 0);
  const totalNominees = stats.reduce((s, x) => s + x.nomineeCount, 0);
  const location = modalLocation(stats);

  const viewAllHref = `/rankings?category=${encodeURIComponent(category.slug)}&sub=all`;

  return (
    <div className="-mt-10">
      <div className="mx-[calc((100%-min(1280px,calc(100vw-32px)))/2)] w-[min(1280px,calc(100vw-32px))]">
        <CategoryHero
          category={category}
          stats={{
            rankingCount: stats.length,
            totalVotes,
            totalNominees,
            location,
          }}
          following={following}
          loggedIn={loggedIn}
        />

        {/* Search + Create Ranking on ONE row */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <form action="/rankings" method="GET" className="relative flex-1">
            <input type="hidden" name="category" value={category.slug} />
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z"
              />
            </svg>
            <input
              type="search"
              name="q"
              defaultValue={query ?? ""}
              placeholder={`Search ${category.name} rankings...`}
              className="w-full rounded-xl border border-border bg-white py-2.5 pl-10 pr-4 text-sm text-ink outline-none placeholder:text-subtle/80 focus:border-ink"
            />
          </form>
          <Link
            href="/rankings/new"
            className="shrink-0 rounded-xl bg-ink px-4 py-2.5 text-center text-sm font-medium text-white hover:opacity-90"
          >
            + Create Ranking
          </Link>
        </div>

        {/* Filter chips */}
        <div className="mt-3">
          <CategoryFilterChips
            categorySlug={category.slug}
            subcategories={subcategories}
            activeSub={activeSub}
          />
        </div>

        {isTrendingView ? (
          <>
            <section className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold tracking-tight text-ink">
                  🔥 Trending in {category.name}
                </h2>
                <Link
                  href={viewAllHref}
                  className="text-sm font-medium text-ink hover:opacity-80"
                >
                  View all →
                </Link>
              </div>
              {trending.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {trending.map((s, i) => (
                    <RankingCoverCard key={s.ranking.id} stat={s} rank={i + 1} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-subtle">
                  No trending rankings right now — check back soon.
                </p>
              )}
            </section>

            <section className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold tracking-tight text-ink">
                  Explore {category.name}
                </h2>
                <Link
                  href={viewAllHref}
                  className="text-sm font-medium text-ink hover:opacity-80"
                >
                  View all →
                </Link>
              </div>
              {explore.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {explore.map((s) => (
                    <RankingCoverCard key={s.ranking.id} stat={s} />
                  ))}
                </div>
              ) : null}
            </section>
          </>
        ) : (
          <section className="mt-6">
            <h2 className="mb-3 text-lg font-bold tracking-tight text-ink">
              {flatHeading}
            </h2>
            {flatSorted.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {flatSorted.map((s) => (
                  <RankingCoverCard key={s.ranking.id} stat={s} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-subtle">
                No rankings here yet. Be the first to start one.
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function activeSubId(
  subcategories: SubcategoryWithCount[],
  slug: string
): string | null {
  return subcategories.find((s) => s.slug === slug)?.id ?? null;
}

// Most common "City, Country" across the category's rankings.
function modalLocation(stats: CategoryRankingStat[]): string {
  const counts = new Map<string, number>();
  for (const s of stats) {
    const city = (s.ranking.city ?? "").trim();
    if (!city || city.toLowerCase() === "global") continue;
    const label = s.ranking.country ? `${city}, ${s.ranking.country}` : city;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [label, n] of counts) {
    if (n > bestCount) {
      best = label;
      bestCount = n;
    }
  }
  return best || "London, United Kingdom";
}
