import Link from "next/link";
import RankingCover from "@/components/homepage/RankingCover";
import { locationLabelFor } from "@/db/homepage";
import type { Ranking } from "@/lib/types";
import HeatMetric from "./HeatMetric";
import OrganicLikeMetric from "./OrganicLikeMetric";

// Standard image ranking card: 16:9 cover, overlay copy in the homepage
// Trending visual language (white text over a local dark gradient).
//
// Cover priority: official coverImage -> category-level fallback artwork
// -> top nominee photo -> branded gradient with initials (inside
// RankingCover; the card can never render a blank image area).
// Metrics: heat (all like sources combined) is always the 🔥 number;
// the ❤️ number is organic likes only and renders only when > 0 —
// "0 likes" is never displayed. Empty rankings keep their cover and
// show an honest "Nominees coming soon" state.
const CATEGORY_CARD_FALLBACK: Record<string, string> = {
  gaming: "/images/category/gaming-hero.webp",
  cosplay: "/images/category/cosplay-hero.webp",
};

export interface RankingImageCardProps {
  ranking: Ranking;
  categoryName: string | null;
  categorySlug?: string | null;
  nomineeCount: number;
  /** Combined likes (seed + organic): the public engagement number. */
  heat: number;
  /** Real organic likes only. Hidden when 0. */
  organicLikes: number;
  topPhotoUrl?: string;
  topNomineeName?: string;
  topAvatarColor?: string;
  eager?: boolean;
}

export function rankingCardHref(ranking: Ranking): string {
  return `/rankings/${ranking.id}`;
}

export default function RankingImageCard({
  ranking,
  categoryName,
  categorySlug,
  nomineeCount,
  heat,
  organicLikes,
  topPhotoUrl = "",
  topNomineeName = "",
  topAvatarColor = "",
  eager = false,
}: RankingImageCardProps) {
  const location = locationLabelFor(ranking);
  const coverUrl =
    ranking.coverImageUrl ||
    (categorySlug ? (CATEGORY_CARD_FALLBACK[categorySlug] ?? null) : null);
  return (
    <Link
      href={rankingCardHref(ranking)}
      className="group relative flex min-h-[280px] flex-col justify-end overflow-hidden rounded-2xl bg-ink p-5 text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      aria-label={`${ranking.title} — view ranking`}
    >
      <RankingCover
        coverUrl={coverUrl}
        coverAlt={ranking.coverImageAlt}
        photoUrl={topPhotoUrl}
        nomineeName={topNomineeName}
        avatarColor={topAvatarColor}
        rankingTitle={ranking.title}
        variant="card"
        eager={eager}
      />
      <div className="relative">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
            📍 {location}
          </span>
          <HeatMetric value={heat} badge />
        </div>
        {categoryName ? (
          <span className="mb-2 inline-block rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-ink">
            ✦ {categoryName}
          </span>
        ) : null}
        <h3 className="line-clamp-2 text-[19px] font-bold leading-snug tracking-tight">
          {ranking.title}
        </h3>
        {ranking.description ? (
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-white/75">
            {ranking.description}
          </p>
        ) : null}
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3 text-[13px] font-medium text-white/85">
            {nomineeCount === 0 ? (
              <span className="truncate">✨ Nominees coming soon</span>
            ) : (
              <span className="shrink-0">👥 {nomineeCount} nominees</span>
            )}
            <OrganicLikeMetric value={organicLikes} />
          </div>
          <span className="shrink-0 whitespace-nowrap rounded-full border border-brand/40 bg-white px-3.5 py-1.5 text-[13px] font-semibold text-brand-ink transition group-hover:border-brand">
            View ranking <span aria-hidden="true">→</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
