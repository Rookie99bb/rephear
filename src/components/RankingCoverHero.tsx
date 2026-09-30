import type { Ranking } from "@/lib/types";
import { resolveCoverForRanking } from "@/services/ranking-images/rankingCoverService";

// Ranking cover hero for the detail page: the ranking's cover image
// (AI editorial, nominee-derived, or fallback per the approved priority).
// The image is presentation-only and never affects scoring.
//
// Cover images may have different original aspect ratios, and the
// important composition (character faces/heads) must never be cropped.
// So the hero NEVER center-crops: the full image is shown with
// object-fit: contain inside an adaptive-height container, and any
// leftover space is filled with a blurred, dimmed extension of the
// same image — never stretched, never zoomed to fill.
export default async function RankingCoverHero({ ranking }: { ranking: Ranking }) {
  const cover = await resolveCoverForRanking(ranking);

  return (
    <div className="relative mb-6 w-full overflow-hidden rounded-2xl bg-surface">
      {/* Blurred extension of the same image fills the frame behind the
          contained artwork, so no empty space and no distortion. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cover.url}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl"
        loading="eager"
        decoding="async"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent"
      />
      {/* The real artwork: full composition, original aspect ratio,
          capped height so the container adapts to the image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cover.url}
        alt={cover.alt}
        className="relative mx-auto max-h-[300px] w-auto max-w-full object-contain sm:max-h-[380px]"
        loading="eager"
        decoding="async"
      />
      <span className="sr-only">{cover.alt}</span>
    </div>
  );
}
