import type { Ranking } from "@/lib/types";
import { resolveCoverForRanking } from "@/services/ranking-images/rankingCoverService";

// Ranking cover hero for the detail page: a wide editorial banner
// showing the ranking's cover image (AI editorial, nominee-derived, or
// fallback per the approved priority). The image is presentation-only
// and never affects scoring.
//
// Per the approved mockup: ranking pages must use rich, relevant
// imagery rather than repeated generic fallback artwork.
export default async function RankingCoverHero({ ranking }: { ranking: Ranking }) {
  const cover = await resolveCoverForRanking(ranking);

  return (
    <div className="relative mb-6 h-44 w-full overflow-hidden rounded-2xl bg-surface sm:h-56">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cover.url}
        alt={cover.alt}
        className="absolute inset-0 h-full w-full object-cover"
        loading="eager"
        decoding="async"
      />
      {/* Bottom gradient for text legibility when title overlays */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"
      />
      <span className="sr-only">{cover.alt}</span>
    </div>
  );
}
