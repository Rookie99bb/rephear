import Link from "next/link";
import RankingCover from "./RankingCover";
import CandidateAvatarStrip from "./CandidateAvatarStrip";
import { compact } from "./format";
import { locationLabelFor, type RankingCardData } from "@/db/homepage";
import type { Ranking } from "@/lib/types";

export interface TrendingCard {
  ranking: Ranking;
  categoryName: string | null;
  data: RankingCardData;
}

// "🔥 Trending in London" — top-3 rankings by real 7-day activity,
// London-scoped preferred for the featured slot. First card is the
// large featured one; the other two are standard visual cards.
export default function TrendingSection({ cards }: { cards: TrendingCard[] }) {
  if (cards.length === 0) return null;
  const [featured, ...rest] = cards;
  return (
    <section aria-label="Trending in London">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-[22px] font-bold tracking-tight text-ink">
            <span aria-hidden="true">🔥</span> Trending in London
          </h2>
          <p className="mt-1 text-sm text-subtle">
            The rankings everyone is talking about right now.
          </p>
        </div>
        <Link
          href="/rankings"
          className="shrink-0 text-sm font-medium text-ink hover:text-brand-ink"
        >
          View all <span aria-hidden="true">→</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[1.42fr_1fr_1fr]">
        <div className="md:col-span-2 lg:col-span-1">
          <FeaturedRankingCard card={featured} eager />
        </div>
        {rest.map((card) => (
          <VisualRankingCard key={card.ranking.id} card={card} />
        ))}
      </div>
    </section>
  );
}

function cardHref(ranking: Ranking): string {
  return `/rankings/${ranking.id}`;
}

function FeaturedRankingCard({
  card,
  eager = false,
}: {
  card: TrendingCard;
  eager?: boolean;
}) {
  const { ranking, data } = card;
  const top = data.topNominees[0];
  const location = locationLabelFor(ranking);
  return (
    <Link
      href={cardHref(ranking)}
      className="group relative flex min-h-[300px] flex-col justify-end overflow-hidden rounded-2xl bg-ink p-6 text-white"
    >
      <RankingCover
        photoUrl={top?.photoUrl ?? ""}
        nomineeName={top?.name ?? ""}
        avatarColor={top?.avatarColor ?? ""}
        rankingTitle={ranking.title}
        variant="featured"
        eager={eager}
      />
      <div className="relative">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-[#ff4d6d] px-3 py-1 text-xs font-semibold text-white">
            🔥 Trending
          </span>
          <span className="text-xs font-medium text-white/80">
            📍 {location === "Global" ? "Global" : `${location}, United Kingdom`}
          </span>
        </div>
        <h3 className="max-w-[320px] text-[26px] font-bold leading-tight tracking-tight">
          {ranking.title}
        </h3>
        {ranking.description && (
          <p className="mt-2 line-clamp-2 max-w-[340px] text-sm text-white/75">
            {ranking.description}
          </p>
        )}
        <div className="mt-4">
          <CandidateAvatarStrip
            nominees={data.topNominees}
            total={data.nomineeCount}
            size={40}
            showCount={5}
          />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-[13px] font-medium text-white/85">
            <span>👥 {data.nomineeCount} nominees</span>
            <span>❤️ {compact(data.totalLikes)} likes</span>
          </div>
          <span
            className="rounded-full px-4 py-2 text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #7B4DFF, #4285F4)" }}
          >
            View ranking <span aria-hidden="true">→</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

function VisualRankingCard({ card }: { card: TrendingCard }) {
  const { ranking, categoryName, data } = card;
  const top = data.topNominees[0];
  const location = locationLabelFor(ranking);
  return (
    <Link
      href={cardHref(ranking)}
      className="group relative flex min-h-[300px] flex-col justify-end overflow-hidden rounded-2xl border border-border bg-white p-5"
    >
      <RankingCover
        photoUrl={top?.photoUrl ?? ""}
        nomineeName={top?.name ?? ""}
        avatarColor={top?.avatarColor ?? ""}
        rankingTitle={ranking.title}
        variant="card"
      />
      <div className="relative">
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          {categoryName && (
            <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-ink">
              ✦ {categoryName}
            </span>
          )}
          <span className="text-xs font-medium text-subtle">📍 {location}</span>
        </div>
        <h3 className="line-clamp-2 text-[19px] font-bold leading-snug tracking-tight text-ink">
          {ranking.title}
        </h3>
        {ranking.description && (
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-subtle">
            {ranking.description}
          </p>
        )}
        <div className="mt-3">
          <CandidateAvatarStrip
            nominees={data.topNominees}
            total={data.nomineeCount}
            size={34}
            showCount={4}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-[13px] font-medium text-subtle">
            <span>👥 {data.nomineeCount} nominees</span>
            <span>
              ❤️ <span className="text-[#e5486f]">{compact(data.totalLikes)}</span>{" "}
              likes
            </span>
          </div>
          <span className="shrink-0 whitespace-nowrap rounded-full border border-brand/40 bg-white px-3.5 py-1.5 text-[13px] font-semibold text-brand-ink">
            View ranking <span aria-hidden="true">→</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
