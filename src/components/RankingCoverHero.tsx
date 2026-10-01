import type { Ranking } from "@/lib/types";
import { resolveCoverForRanking } from "@/services/ranking-images/rankingCoverService";

// Ranking cover hero for the detail page: the ranking's cover image
// (AI editorial, nominee-derived, or fallback per the approved priority).
// The image is presentation-only and never affects scoring.
//
// Cover-first rule: the artwork is the primary visual surface — it fills
// the hero frame edge to edge (object-fit: cover, full colour, opacity 1,
// no blur, no brightness/saturation reduction, no white wash). No text is
// overlaid on this hero, so no legibility gradient is needed.
// object-position: top keeps faces/heads (usually composed near the top)
// inside the crop.
export default async function RankingCoverHero({ ranking }: { ranking: Ranking }) {
  const cover = await resolveCoverForRanking(ranking);

  return (
    <div className="relative mb-6 h-52 w-full overflow-hidden rounded-2xl bg-surface sm:h-72">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cover.url}
        alt={cover.alt}
        className="absolute inset-0 h-full w-full object-cover object-top"
        loading="eager"
        decoding="async"
      />
      <span className="sr-only">{cover.alt}</span>
    </div>
  );
}
