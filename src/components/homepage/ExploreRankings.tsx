import Link from "next/link";
import RankingCover from "./RankingCover";
import CandidateAvatarStrip from "./CandidateAvatarStrip";
import RankingFilters from "./RankingFilters";
import { compact } from "./format";
import {
  getRankingCardData,
  locationLabelFor,
  type ExploreRanking,
} from "@/db/homepage";
import { listCategories } from "@/db/categories";
import { listPopularRegions } from "@/db/rankings";
import type { Category } from "@/lib/types";

// "Explore Rankings" — compact visual cards with working filters.
// Filter state lives in the homepage URL query params so the grid is
// server-rendered and shareable.
export default async function ExploreRankings({
  items,
  activeCategory,
  activeCity,
  activeSort,
}: {
  items: ExploreRanking[];
  activeCategory: string;
  activeCity: string;
  activeSort: string;
}) {
  if (items.length === 0) return null;
  const categories: Category[] = await listCategories();
  const regions = await listPopularRegions(12);
  // Card data (avatar strips, counts) per ranking.
  const cardData = await Promise.all(
    items.map((item) => getRankingCardData(item.ranking.id))
  );

  return (
    <section aria-label="Explore rankings">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-bold tracking-tight text-ink">
            Explore Rankings
          </h2>
          <p className="mt-1 text-sm text-subtle">
            Discover more rankings across your favourite communities.
          </p>
        </div>
        <RankingFilters
          categories={categories}
          regions={regions}
          activeCategory={activeCategory}
          activeCity={activeCity}
          activeSort={activeSort}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, i) => (
          <CompactRankingCard
            key={item.ranking.id}
            item={item}
            data={cardData[i]}
          />
        ))}
      </div>
    </section>
  );
}

function CompactRankingCard({
  item,
  data,
}: {
  item: ExploreRanking;
  data: Awaited<ReturnType<typeof getRankingCardData>>;
}) {
  const { ranking, categoryName } = item;
  const top = data.topNominees[0];
  const location = locationLabelFor(ranking);
  return (
    <Link
      href={`/rankings/${ranking.id}`}
      className="group relative flex h-[300px] flex-col justify-end overflow-hidden rounded-2xl transition hover:shadow-lg"
    >
      <RankingCover
        photoUrl={top?.photoUrl ?? ""}
        nomineeName={top?.name ?? ""}
        avatarColor={top?.avatarColor ?? ""}
        rankingTitle={ranking.title}
        variant="fullbleed"
      />
      <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
        {categoryName && (
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-brand-ink backdrop-blur-sm">
            ✦ {categoryName}
          </span>
        )}
        <span className="rounded-full bg-black/35 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
          📍 {location}
        </span>
      </div>
      <div className="relative p-4">
        <h3 className="line-clamp-2 text-[16px] font-bold leading-snug tracking-tight text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.45)]">
          {ranking.title}
        </h3>
        <div className="mt-2.5">
          <CandidateAvatarStrip
            nominees={data.topNominees}
            total={data.nomineeCount}
            size={30}
            showCount={4}
          />
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-[13px] font-medium text-white/90">
            <span>👥 {data.nomineeCount} nominees</span>
            {data.totalLikes > 0 && <span>❤️ {compact(data.totalLikes)} likes</span>}
          </div>
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-ink transition group-hover:bg-brand group-hover:text-white"
          >
            →
          </span>
        </div>
      </div>
    </Link>
  );
}
