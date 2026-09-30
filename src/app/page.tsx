import Link from "next/link";
import HeroDiscovery from "@/components/homepage/HeroDiscovery";
import TrendingSection, {
  type TrendingCard,
} from "@/components/homepage/TrendingSection";
import ActivityGrid, {
  type RisingItem,
} from "@/components/homepage/ActivityGrid";
import ExploreRankings from "@/components/homepage/ExploreRankings";
import { listCategories } from "@/db/categories";
import { listTrendingRankings } from "@/db/rankings";
import {
  findCloseBattle,
  findPublicRankingIdsBySlugs,
  getCategoryNameForRanking,
  getRankingCardData,
  listExploreRankings,
  listFeaturedRankings,
  listVelocityRankings,
} from "@/db/homepage";
import {
  prioritizeForHomepage,
  selectFeaturedThree,
  selectExploreEight,
} from "@/lib/homepageMerchandising";

export default async function HomePage({
  searchParams,
}: {
  searchParams: { category?: string; city?: string; sort?: string };
}) {
  const categories = await listCategories();

  // Weekly velocity (likes + support credits in the last 7 days) drives
  // both "🔥 Trending in London" and "🚀 Rising Now". Every row carries its
  // own public ranking, so no unfiltered lookup is ever needed.
  const velocity = await listVelocityRankings(8);

  // "🔥 Trending in London" / "✨ Featured in London": strict spec §2.
  // When eligible content exists, the 3 cards MUST come from 3 different
  // Tier-1 categories (Anime > Gaming > Manga > Cosplay priority).
  // The underlying velocity scores are never changed — we only select
  // which eligible rankings fill the three cards. Seed likes never
  // trigger a trending slot; they only count toward displayed totals.
  const merchandised = await prioritizeForHomepage(velocity);
  const picks = await selectFeaturedThree(merchandised);
  // The section always renders 3 cards: real organic trending first,
  // then Featured fallback (Anime > Gaming > Manga > Cosplay priority)
  // for the remaining slots. Seed likes never trigger a trending slot —
  // they only count toward the displayed like totals.
  const featuredFills =
    picks.length < 3
      ? await listFeaturedRankings(
          picks.map((v) => v.ranking.id),
          3 - picks.length
        )
      : [];
  const trendingCards: TrendingCard[] = [
    ...(await Promise.all(
      picks.map(async (v) => ({
        ranking: v.ranking,
        categoryName: await getCategoryNameForRanking(v.ranking),
        data: await getRankingCardData(v.ranking.id),
        isFeaturedFill: false,
      }))
    )),
    ...(await Promise.all(
      featuredFills.map(async (ranking) => ({
        ranking,
        categoryName: await getCategoryNameForRanking(ranking),
        data: await getRankingCardData(ranking.id),
        isFeaturedFill: true,
      }))
    )),
  ];
  // No real organic trending at all → the section is honestly labelled
  // as Featured instead of Trending.
  const trendingMode = picks.length === 0 ? "featured" : "trending";

  // Close Battles: tightest real top-2 support-credit race across the
  // most active rankings. Null → the module hides itself (never faked).
  const battle = await findCloseBattle(await listTrendingRankings(12));

  // Rising Now: honest 7-day velocity (likes + credits), never position
  // deltas (no ranking-history data exists). ACG-first merchandising
  // applies here too — same prioritizeForHomepage ordering as Trending.
  // We never fabricate growth; if insufficient ACG content qualifies,
  // the section shows what genuinely qualifies (truthfully labelled).
  const rising: RisingItem[] = [];
  for (const v of merchandised.slice(0, 3)) {
    const data = await getRankingCardData(v.rankingId);
    const top = data.topNominees[0];
    rising.push({
      ranking: v.ranking,
      likes7d: v.likes7d,
      credits7d: v.credits7d,
      thumbPhotoUrl: top?.photoUrl ?? "",
      thumbName: top?.name ?? "",
      thumbColor: top?.avatarColor ?? "",
    });
  }

  // Event deep-links: only these two rankings are known to exist as real
  // event-adjacent rankings (resolved by slug, public-only). Anything else
  // stays unlinked rather than pointing at an invented route.
  const eventRankingIds = await findPublicRankingIdsBySlugs([
    "cosplayers-to-watch-at-animecon-london-2026",
    "tcg-traders-to-meet-at-noli-tcg-card-show",
  ]);
  const eventHrefs: Record<string, string> = {};
  for (const [slug, id] of eventRankingIds) {
    eventHrefs[slug] = `/rankings/${id}`;
  }

  // Explore Rankings: filter state lives in the URL query params.
  // Strict spec §3-§4: in the DEFAULT state (no user filters), the first
  // 4 cards MUST be 1 Anime + 1 Gaming + 1 Manga + 1 Cosplay, and the
  // first 8 MUST be predominantly ACG. User-selected filters override
  // this policy entirely.
  const activeCategory = searchParams.category?.trim() ?? "";
  const activeCity = searchParams.city?.trim() ?? "";
  const activeSort = searchParams.sort === "newest" ? "newest" : "trending";
  const isDefaultExplore =
    !activeCategory && !activeCity && searchParams.sort !== "newest";
  const exploreRaw = await listExploreRankings({
    categorySlug: activeCategory || undefined,
    city: activeCity || undefined,
    sort: activeSort,
    // Default state: fetch a large pool so selectExploreEight can ensure
    // Tier-1 category coverage (Anime+Gaming+Manga+Cosplay). Filtered
    // states use the normal limit (user intent overrides).
    limit: isDefaultExplore ? 100 : 4,
  });
  const explore = isDefaultExplore
    ? await selectExploreEight(exploreRaw)
    : exploreRaw;

  if (trendingCards.length === 0 && explore.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          RepHear
        </h1>
        <p className="max-w-md text-sm text-subtle">
          An open public ranking platform. Be the first to create a Ranking
          and start building public reputation together.
        </p>
        <Link
          href="/rankings/new"
          className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Create the first Ranking
        </Link>
      </div>
    );
  }

  return (
    // Full-bleed breakout: the layout's <main> is a centred max-w-5xl
    // container; the redesigned homepage needs the full viewport width
    // (reference is 1312px). This is the standard centred-container
    // breakout — it spans exactly the viewport, and body has
    // overflow-x: clip so the scrollbar width never causes sideways scroll.
    <div className="relative left-1/2 w-screen -translate-x-1/2">
      <div className="-mt-10">
        <HeroDiscovery categories={categories} />
      </div>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="flex flex-col gap-10 py-10 md:gap-12">
          <TrendingSection cards={trendingCards} mode={trendingMode} />
          <ActivityGrid battle={battle} rising={rising} eventHrefs={eventHrefs} />
          <ExploreRankings
            items={explore}
            activeCategory={activeCategory}
            activeCity={activeCity}
            activeSort={activeSort}
          />
        </div>
      </div>
    </div>
  );
}
