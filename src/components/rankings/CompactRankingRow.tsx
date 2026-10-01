import Link from "next/link";
import RankingCover from "@/components/homepage/RankingCover";
import { locationLabelFor } from "@/db/homepage";
import type { Ranking } from "@/lib/types";
import HeatMetric from "./HeatMetric";
import OrganicLikeMetric from "./OrganicLikeMetric";
import { rankingCardHref } from "./RankingImageCard";

// Compact horizontal row for the 🚀 Rising section: thumbnail left,
// title/description middle, heat + View ranking right. Single-line
// truncation throughout so long titles can never overflow the row or
// the viewport on mobile.
export default function CompactRankingRow({
  ranking,
  categoryName,
  nomineeCount,
  heat,
  organicLikes,
  topPhotoUrl = "",
  topNomineeName = "",
  topAvatarColor = "",
  eager = false,
}: {
  ranking: Ranking;
  categoryName: string | null;
  nomineeCount: number;
  heat: number;
  organicLikes: number;
  topPhotoUrl?: string;
  topNomineeName?: string;
  topAvatarColor?: string;
  eager?: boolean;
}) {
  const location = locationLabelFor(ranking);
  return (
    <Link
      href={rankingCardHref(ranking)}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-white p-3 transition hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      aria-label={`${ranking.title} — view ranking`}
    >
      <span className="relative block h-[76px] w-[112px] shrink-0 overflow-hidden rounded-xl bg-ink">
        <RankingCover
          coverUrl={ranking.coverImageUrl}
          coverAlt={ranking.coverImageAlt}
          photoUrl={topPhotoUrl}
          nomineeName={topNomineeName}
          avatarColor={topAvatarColor}
          rankingTitle={ranking.title}
          variant="thumb"
          eager={eager}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-medium uppercase tracking-wide text-subtle">
          📍 {location}
          {categoryName ? ` · ${categoryName}` : ""}
        </span>
        <span className="block truncate text-[15px] font-semibold tracking-tight text-ink">
          {ranking.title}
        </span>
        {ranking.description ? (
          <span className="hidden truncate text-[13px] text-subtle sm:block">
            {ranking.description}
          </span>
        ) : null}
        <span className="mt-0.5 flex items-center gap-3 text-[13px] text-subtle">
          {nomineeCount === 0 ? (
            <span className="truncate">✨ Nominees coming soon</span>
          ) : (
            <span className="shrink-0">👥 {nomineeCount} nominees</span>
          )}
          <OrganicLikeMetric value={organicLikes} />
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1.5">
        <HeatMetric value={heat} badge />
        <span className="whitespace-nowrap text-[13px] font-semibold text-brand-ink">
          View ranking <span aria-hidden="true">→</span>
        </span>
      </span>
    </Link>
  );
}
