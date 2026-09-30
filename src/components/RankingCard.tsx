import Link from "next/link";
import type { Ranking } from "@/lib/types";
import {
  getRankingLocationLabel,
  RANKING_BADGE_META,
  formatCompactCount,
  type RankingBadge,
} from "@/lib/rankingDisplay";
import { getCategoryFallbackCard } from "@/services/ranking-images/categoryFallbacks";
import RankingCover from "./RankingCover";

// Horizontal ranking card: [ cover image ~30% | content ~70% ].
// Clean, minimal, premium: white card, subtle border, image-led but not
// image-heavy. Covers are presentation-only and never affect scoring.
export default function RankingCard({
  ranking,
  badge,
  categorySlug,
  likeCount,
  nomineeCount,
  eagerImage = false,
}: {
  ranking: Ranking;
  badge?: RankingBadge;
  // Resolved category slug for the fallback image (when known).
  categorySlug?: string | null;
  likeCount?: number;
  nomineeCount?: number;
  eagerImage?: boolean;
}) {
  const badgeMeta = badge ? RANKING_BADGE_META[badge] : null;
  const coverSrc =
    ranking.coverImageUrl?.trim() ||
    getCategoryFallbackCard(categorySlug ?? ranking.categoryId);
  const coverAlt =
    ranking.coverImageAlt || `${ranking.title} — RepHear ranking`;
  return (
    <Link
      href={`/rankings/${ranking.id}`}
      className="flex min-h-[148px] overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white transition hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
    >
      <div className="relative w-[30%] min-w-[110px] shrink-0 self-stretch bg-[#f6f5fa]">
        <RankingCover
          src={coverSrc}
          alt={coverAlt}
          fallbackSrc={getCategoryFallbackCard(categorySlug ?? ranking.categoryId)}
          eager={eagerImage}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {badgeMeta && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#f1ecfd] px-2 py-0.5 text-[11px] font-medium text-[#6d28d9]">
              <span aria-hidden>{badgeMeta.emoji}</span>
              {badgeMeta.label}
            </span>
          )}
          <span className="text-[11px] text-subtle">
            {getRankingLocationLabel(ranking)}
          </span>
        </div>
        <h3 className="mt-1.5 line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight text-ink">
          {ranking.title}
        </h3>
        {ranking.description && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-subtle">
            {ranking.description}
          </p>
        )}
        {(likeCount !== undefined || nomineeCount !== undefined) && (
          <div className="mt-auto flex items-center gap-4 pt-2 text-[12px] text-subtle">
            <span className="inline-flex items-center gap-1">
              <span aria-hidden>❤️</span>
              <span className="font-medium text-ink">
                {formatCompactCount(likeCount ?? 0)}
              </span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span aria-hidden>👥</span>
              <span>
                {formatCompactCount(nomineeCount ?? 0)}{" "}
                {nomineeCount === 1 ? "nominee" : "nominees"}
              </span>
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
