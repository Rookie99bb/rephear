import Link from "next/link";
import GlobalDiscoveryHero from "@/components/GlobalDiscoveryHero";
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
  listRisingNow,
  listVelocityRankings,
} from "@/db/homepage";
import {
  getManualCuratedRankings,
} from "@/db/curation";
import {
  prioritizeForHomepage,
} from "@/lib/homepageMerchandising";

export default async function HomePage({
  searchParams,
}: {
  searchParams: { category?: string; city?: string; sort?: string };
}) {
  const categories = await listCategories();

  // "🔥 Trending in London": manual-first (admin curation, see
  // src/db/curation.ts). Curated picks occupy the first slots in admin
  // position order; the automatic logic below fills whatever slots
  // remain, never duplicating a curated ranking. With nothing curated
  // the behaviour is exactly what it was before.
  const manualTrending = (await getManualCuratedRankings("trending")).slice(0, 3);
  const manualIds = new Set(manualTrending.map((r) => r.id));
  const trendingSlotsLeft = 3 - manualTrending.length;

  // Weekly velocity (likes + support credits in the last 7 days) drives
  // the automatic picks. Every row carries its own public ranking, so no
  // unfiltered lookup is ever needed.
  const velocity = (await listVelocityRankings(8)).filter(
    (v) => !manualIds.has(v.ranking.id),
  );

  // "🔥 Trending in London": ACG-first merchandising (see
  // homepageMerchandising.ts). The underlying velocity scores are never
  // changed — we only re-prioritize which eligible rankings fill the
  // three cards. Prefer London ACG for the featured slot; allow Global
  // ACG to fill when London ACG is insufficient. Never use unrelated
  // London content merely to fill the row.
  const merchandised = await prioritizeForHomepage(velocity);
  const isLondon = (v: (typeof velocity)[number]) =>
    (v.ranking.city ?? "").trim().toLowerCase() === "london";
  // Featured: best London ACG, else best ACG (any scope), else best London, else best overall.
  const featuredPick =
    merchandised.find(isLondon) ??
    merchandised[0] ??
    velocity.find(isLondon) ??
    velocity[0];
  const picks = [
    ...(featuredPick ? [featuredPick] : []),
    ...merchandised.filter((v) => v !== featuredPick),
  ].slice(0, trendingSlotsLeft);
  // The section always renders 3 cards: manual curation first, then real
  // organic trending, then Featured fallback (Anime > Gaming > Manga >
  // Cosplay priority) for the remaining slots. Seed likes never trigger
  // a trending slot — they only count toward the displayed like totals.
  const excludeIds = [
    ...manualIds,
    ...picks.map((v) => v.ranking.id),
  ];
  const featuredFills =
    picks.length + manualTrending.length < 3
      ? await listFeaturedRankings(
          excludeIds,
          3 - picks.length - manualTrending.length,
        )
      : [];
  const trendingCards: TrendingCard[] = [
    ...(await Promise.all(
      manualTrending.map(async (ranking) => ({
        ranking,
        categoryName: await getCategoryNameForRanking(ranking),
        data: await getRankingCardData(ranking.id),
        isFeaturedFill: false,
      })),
    )),
    ...(await Promise.all(
      picks.map(async (v) => ({
        ranking: v.ranking,
        categoryName: await getCategoryNameForRanking(v.ranking),
        data: await getRankingCardData(v.ranking.id),
        isFeaturedFill: false,
      })),
    )),
    ...(await Promise.all(
      featuredFills.map(async (ranking) => ({
        ranking,
        categoryName: await getCategoryNameForRanking(ranking),
        data: await getRankingCardData(ranking.id),
        isFeaturedFill: true,
      })),
    )),
  ];
  // No manual curation and no real organic trending at all → the section
  // is honestly labelled as Featured instead of Trending.
  const trendingMode =
    manualTrending.length === 0 && picks.length === 0 ? "featured" : "trending";

  // Close Battles: tightest real top-2 support-credit race across the
  // most active rankings. Null → the module hides itself (never faked).
  const battle = await findCloseBattle(await listTrendingRankings(12));

  // Rising Now: cold-start aware (see src/config/risingColdStart.ts).
  // Cold-start ON (production launch phase): ~6 ACG-diverse public
  // rankings; the displayed number is organic weekly + seed weekly.
  // Seed lives in config only — no fake accounts, no fake like rows,
  // organic data untouched and internally distinguishable.
  // Cold-start OFF: organic-only 7-day velocity.
  // Up to 6 compact rows; the UI formats the number, never invents it.
  const risingNow = await listRisingNow(6);
  const rising: RisingItem[] = [];
  for (const row of risingNow) {
    const data = await getRankingCardData(row.ranking.id);
    const top = data.topNominees[0];
    rising.push({
      ranking: row.ranking,
      likes7d: row.displayLikes7d,
      credits7d: row.credits7d,
      likesPrev7d: row.likesPrev7d,
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
  const activeCategory = searchParams.category?.trim() ?? "";
  const activeCity = searchParams.city?.trim() ?? "";
  const activeSort = searchParams.sort === "newest" ? "newest" : "trending";
  const explore = await listExploreRankings({
    categorySlug: activeCategory || undefined,
    city: activeCity || undefined,
    sort: activeSort,
    limit: 4,
  });

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
        {/* Site-wide permanent hero, full variant on the homepage. */}
        <GlobalDiscoveryHero variant="full" categories={categories} />
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
