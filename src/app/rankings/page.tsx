import Link from "next/link";
import type { Metadata } from "next";
import { listAllRankings, searchRankings } from "@/db/rankings";
import { findCategoryBySlug, listCategories } from "@/db/categories";
import { getCurrentUser } from "@/lib/session";
import { isFollowing } from "@/db/follows";
import NotificationBell from "@/components/NotificationBell";
import CategoryPageView from "@/components/category/CategoryPageView";
import GlobalDiscoveryHero from "@/components/GlobalDiscoveryHero";
import RankingImageCard from "@/components/rankings/RankingImageCard";
import FeaturedRankingCard from "@/components/rankings/FeaturedRankingCard";
import CompactRankingRow from "@/components/rankings/CompactRankingRow";
import {
  listCategoryRankingsWithStats,
  listSubcategoriesWithCounts,
} from "@/db/categoryPage";
import {
  findPublicRankingIdsBySlugs,
  getCategoryNameForRanking,
  getRankingCardData,
  getRankingsBrowseStats,
  listExploreRankings,
  listRisingNow,
  type RankingBrowseStat,
  type RankingCardData,
} from "@/db/homepage";
import { UpcomingEvents } from "@/components/homepage/ActivityGrid";
import { getNewRankings } from "@/db/discovery";
import type { Category, Ranking } from "@/lib/types";

export const metadata: Metadata = {
  title: "Rankings",
  description:
    "Browse public reputation Rankings on RepHear — see who's leading in London.",
  alternates: { canonical: "/rankings" },
};

// Full-bleed breakout: the layout's <main> is a centred max-w-5xl
// container; the hero and the card sections need the full viewport width
// (reference is 1280px). Standard centred-container breakout — spans
// exactly the viewport, and body has overflow-x: clip so the scrollbar
// width never causes sideways scroll.
function FullBleed({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2">
      {children}
    </div>
  );
}

function toBrowseStat(
  rankingId: string,
  data: RankingCardData,
): RankingBrowseStat {
  const top = data.topNominees[0];
  return {
    rankingId,
    nomineeCount: data.nomineeCount,
    heat: data.totalLikes,
    organicLikes: data.organicLikes,
    topPhotoUrl: top?.photoUrl ?? "",
    topNomineeName: top?.name ?? "",
    topAvatarColor: top?.avatarColor ?? "",
  };
}

function cardProps(
  ranking: Ranking,
  stat: RankingBrowseStat | undefined,
  catById: Map<string, Category>,
) {
  const cat = ranking.categoryId ? catById.get(ranking.categoryId) : undefined;
  return {
    ranking,
    categoryName: cat?.name ?? null,
    categorySlug: cat?.slug ?? null,
    nomineeCount: stat?.nomineeCount ?? 0,
    heat: stat?.heat ?? 0,
    organicLikes: stat?.organicLikes ?? 0,
    topPhotoUrl: stat?.topPhotoUrl ?? "",
    topNomineeName: stat?.topNomineeName ?? "",
    topAvatarColor: stat?.topAvatarColor ?? "",
  };
}

function SectionHeading({
  icon,
  title,
  blurb,
  href,
}: {
  icon: string;
  title: string;
  blurb?: string;
  href?: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-[22px] font-bold tracking-tight text-ink">
          <span aria-hidden="true">{icon}</span> {title}
        </h2>
        {blurb ? <p className="mt-1 text-sm text-subtle">{blurb}</p> : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="shrink-0 text-sm font-medium text-ink hover:text-brand-ink"
        >
          View all <span aria-hidden="true">→</span>
        </Link>
      ) : null}
    </div>
  );
}

// A search (?q=) filters by title/description and takes priority. A
// category (?category=<slug>, linked from the hero category entries)
// renders the visual category page (CategoryPageView); an optional
// ?sub=<subcategory-slug|all> filters it further. The default view is
// the merchandised browse page: hero -> title/search/filter -> Trending
// -> Rising -> New -> by-category -> all.
export default async function BrowseRankingsPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; sub?: string };
}) {
  const query = searchParams.q?.trim();
  const categorySlug = searchParams.category?.trim();
  const subParam = searchParams.sub?.trim() || null;
  const categories = await listCategories();
  const catById = new Map(categories.map((c) => [c.id, c]));
  const user = await getCurrentUser();

  // ---- Category view -------------------------------------------------
  const activeCategory = categorySlug
    ? await findCategoryBySlug(categorySlug)
    : null;
  if (activeCategory) {
    const rankings: Ranking[] = query
      ? await searchRankings(query)
      : await listAllRankings();
    const inCategoryIds = new Set(
      rankings
        .filter((r) => r.categoryId === activeCategory.id)
        .map((r) => r.id),
    );
    const allStats = await listCategoryRankingsWithStats(activeCategory.id);
    const stats = allStats.filter((s) => inCategoryIds.has(s.ranking.id));
    const subcategories = await listSubcategoriesWithCounts(activeCategory.id);
    const activeSubName =
      subParam && subParam !== "all"
        ? (subcategories.find((s) => s.slug === subParam)?.name ?? null)
        : null;
    const followingCategory = user
      ? await isFollowing(user.id, "category", activeCategory.id)
      : false;
    return (
      <>
        <FullBleed>
          <div className="-mt-10">
            <GlobalDiscoveryHero variant="full" categories={categories} />
          </div>
        </FullBleed>
        <CategoryPageView
          category={activeCategory}
          stats={stats}
          subcategories={subcategories}
          activeSub={subParam}
          activeSubName={activeSubName}
          query={query ?? null}
          following={followingCategory}
          loggedIn={!!user}
        />
      </>
    );
  }

  // ---- Search view ---------------------------------------------------
  if (query) {
    const rankings = await searchRankings(query);
    const stats = await getRankingsBrowseStats(rankings.map((r) => r.id));
    return (
      <>
        <FullBleed>
          <div className="-mt-10">
            <GlobalDiscoveryHero variant="full" categories={categories} />
          </div>
        </FullBleed>
        <div className="pt-8">
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Rankings
          </h1>
          <p className="mt-1 text-sm text-subtle">
            Search results for &ldquo;{query}&rdquo;
            {" — "}
            <Link href="/rankings" className="underline">
              clear search
            </Link>
          </p>
          {rankings.length === 0 ? (
            <p className="mt-6 text-sm text-subtle">
              No Rankings match &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rankings.map((r, i) => (
                <RankingImageCard
                  key={r.id}
                  {...cardProps(r, stats.get(r.id), catById)}
                  eager={i < 3}
                />
              ))}
            </div>
          )}
        </div>
      </>
    );
  }

  // ---- Default browse view -------------------------------------------
  const rankings = await listAllRankings();
  const [trending, risingRows, fresh] = await Promise.all([
    listExploreRankings({ sort: "trending", limit: 3 }),
    listRisingNow(6),
    getNewRankings(6),
  ]);
  const [trendingCards, risingCards, freshCards] = await Promise.all([
    Promise.all(
      trending.map(async (t) => {
        const data = await getRankingCardData(t.ranking.id);
        return {
          item: t,
          stat: toBrowseStat(t.ranking.id, data),
          topNominees: data.topNominees,
        };
      }),
    ),
    Promise.all(
      risingRows.map(async (row) => ({
        ranking: row.ranking,
        categoryName: await getCategoryNameForRanking(row.ranking),
        stat: toBrowseStat(
          row.ranking.id,
          await getRankingCardData(row.ranking.id),
        ),
      })),
    ),
    Promise.all(
      fresh.map(async (r) => ({
        ranking: r,
        categoryName: await getCategoryNameForRanking(r),
        stat: toBrowseStat(r.id, await getRankingCardData(r.id)),
      })),
    ),
  ]);

  // Group the flat ranking list by parent category for the
  // "browse by category" section. The final "All rankings" grid always
  // shows the complete public list (spec section 8: 全部榜单).
  const byCategoryId = new Map<string, Ranking[]>();
  for (const r of rankings) {
    if (r.categoryId && catById.has(r.categoryId)) {
      const arr = byCategoryId.get(r.categoryId) ?? [];
      arr.push(r);
      byCategoryId.set(r.categoryId, arr);
    }
  }
  const categoryGroups = categories
    .filter((c) => byCategoryId.has(c.id))
    .map((c) => ({ category: c, rankings: byCategoryId.get(c.id)! }));
  const bulkStats = await getRankingsBrowseStats(rankings.map((r) => r.id));

  // Upcoming Events deep-links: same two event-adjacent rankings as the
  // homepage (resolved by slug, public-only). Static event list itself
  // costs zero DB reads; this is two indexed point lookups.
  const eventRankingIds = await findPublicRankingIdsBySlugs([
    "cosplayers-to-watch-at-animecon-london-2026",
    "tcg-traders-to-meet-at-noli-tcg-card-show",
  ]);
  const eventHrefs: Record<string, string> = {};
  for (const [slug, id] of eventRankingIds) {
    eventHrefs[slug] = `/rankings/${id}`;
  }

  return (
    <>
      <FullBleed>
        <div className="-mt-10">
          {/* Same full hero as the homepage. */}
          <GlobalDiscoveryHero variant="full" categories={categories} />
        </div>
      </FullBleed>
      <FullBleed>
        <div className="mx-auto max-w-[1280px] px-4 pt-8 sm:px-6">
          <div className="flex flex-col gap-10 pb-4 md:gap-12">
            <div>
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-ink">
                    Rankings
                  </h1>
                  <p className="mt-1 text-sm text-subtle">
                    Discover public reputation rankings — who&apos;s leading
                    in London and beyond.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <NotificationBell />
                  <Link
                    href="/rankings/new"
                    className="rounded-xl bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                  >
                    Create Ranking
                  </Link>
                </div>
              </div>

              <form action="/rankings" method="GET" className="mb-5">
                <input
                  type="search"
                  name="q"
                  placeholder="Search Rankings by title or description…"
                  className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-ink"
                  aria-label="Search rankings"
                />
              </form>

              {/* Category filter: horizontal scroll on mobile, wrap on desktop. */}
              <nav
                aria-label="Filter by category"
                className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap"
              >
                {categories.map((c) => (
                  <Link
                    key={c.id}
                    href={`/rankings?category=${encodeURIComponent(c.slug)}`}
                    className="shrink-0 rounded-full border border-border bg-white px-3.5 py-1.5 text-[13px] font-medium text-ink shadow-sm transition hover:border-brand hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    {c.name}
                  </Link>
                ))}
              </nav>
            </div>

            {trendingCards.length > 0 && (
              <section aria-label="Trending rankings">
                <SectionHeading
                  icon="🔥"
                  title="Trending"
                  blurb="The rankings everyone is talking about right now."
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {trendingCards.map(({ item, stat, topNominees }, i) => (
                    <FeaturedRankingCard
                      key={item.ranking.id}
                      ranking={item.ranking}
                      categoryName={item.categoryName}
                      nomineeCount={stat.nomineeCount}
                      heat={stat.heat}
                      organicLikes={stat.organicLikes}
                      topNominees={topNominees}
                      eager={i === 0}
                    />
                  ))}
                </div>
              </section>
            )}

            {risingCards.length > 0 && (
              <section aria-label="Rising this week">
                <SectionHeading
                  icon="🚀"
                  title="Rising This Week"
                  blurb="Rankings with the most likes and backing activity in the last 7 days."
                />
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {risingCards.map(({ ranking, categoryName, stat }, i) => (
                    <CompactRankingRow
                      key={ranking.id}
                      ranking={ranking}
                      categoryName={categoryName}
                      nomineeCount={stat.nomineeCount}
                      heat={stat.heat}
                      organicLikes={stat.organicLikes}
                      topPhotoUrl={stat.topPhotoUrl}
                      topNomineeName={stat.topNomineeName}
                      topAvatarColor={stat.topAvatarColor}
                      eager={i < 2}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Same 🗓️ Upcoming Events module as the homepage. */}
            <UpcomingEvents eventHrefs={eventHrefs} />

            {freshCards.length > 0 && (
              <section aria-label="New to RepHear">
                <SectionHeading
                  icon="✨"
                  title="New to RepHear"
                  blurb="Rankings started in the last 30 days — get in early."
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {freshCards.map(({ ranking, categoryName, stat }) => (
                    <RankingImageCard
                      key={ranking.id}
                      {...cardProps(
                        ranking,
                        stat,
                        catById,
                      )}
                      categoryName={categoryName}
                    />
                  ))}
                </div>
              </section>
            )}

            {categoryGroups.length > 0 && (
              <section aria-label="Browse by category">
                <SectionHeading
                  icon="🗂️"
                  title="Browse by category"
                />
                <div className="flex flex-col gap-8">
                  {categoryGroups.map(({ category, rankings: group }) => (
                    <div key={category.id}>
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-base font-bold tracking-tight text-ink">
                          {category.name}
                        </h3>
                        <Link
                          href={`/rankings?category=${encodeURIComponent(category.slug)}`}
                          className="shrink-0 text-sm font-medium text-ink hover:text-brand-ink"
                        >
                          View all <span aria-hidden="true">→</span>
                        </Link>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {group.slice(0, 4).map((r) => (
                          <RankingImageCard
                            key={r.id}
                            {...cardProps(r, bulkStats.get(r.id), catById)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {rankings.length > 0 && (
              <section aria-label="All rankings">
                <SectionHeading icon="📋" title="All rankings" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {rankings.map((r) => (
                    <RankingImageCard
                      key={r.id}
                      {...cardProps(r, bulkStats.get(r.id), catById)}
                    />
                  ))}
                </div>
              </section>
            )}

            {rankings.length === 0 && (
              <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
                <p className="text-sm text-subtle">
                  No rankings here yet. Be the first to start recognition in
                  your community.
                </p>
                <Link
                  href="/rankings/new"
                  className="mt-4 inline-block rounded-xl bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  Create the first ranking
                </Link>
              </div>
            )}
          </div>
        </div>
      </FullBleed>
    </>
  );
}
