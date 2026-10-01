import Link from "next/link";
import RankingCover from "@/components/homepage/RankingCover";
import CandidateAvatarStrip from "@/components/homepage/CandidateAvatarStrip";
import { locationLabelFor } from "@/db/homepage";
import type { Profile, Ranking } from "@/lib/types";
import HeatMetric from "./HeatMetric";
import OrganicLikeMetric from "./OrganicLikeMetric";
import { rankingCardHref } from "./RankingImageCard";

// Large featured card for the 🔥 Trending section: bigger artwork, the
// top nominees' avatar strip, and a gradient View ranking button — the
// same visual language as the homepage featured card.
export default function FeaturedRankingCard({
  ranking,
  categoryName,
  nomineeCount,
  heat,
  organicLikes,
  topNominees,
  badge = "🔥 Trending",
  eager = false,
}: {
  ranking: Ranking;
  categoryName: string | null;
  nomineeCount: number;
  heat: number;
  organicLikes: number;
  topNominees: Profile[];
  badge?: string;
  eager?: boolean;
}) {
  const location = locationLabelFor(ranking);
  const top = topNominees[0];
  return (
    <Link
      href={rankingCardHref(ranking)}
      className="group relative flex min-h-[320px] flex-col justify-end overflow-hidden rounded-2xl bg-ink p-6 text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      aria-label={`${ranking.title} — view ranking`}
    >
      <RankingCover
        coverUrl={ranking.coverImageUrl}
        coverAlt={ranking.coverImageAlt}
        photoUrl={top?.photoUrl ?? ""}
        nomineeName={top?.name ?? ""}
        avatarColor={top?.avatarColor ?? ""}
        rankingTitle={ranking.title}
        variant="featured"
        eager={eager}
      />
      <div className="relative">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#ff4d6d] px-3 py-1 text-xs font-semibold text-white">
            {badge}
          </span>
          <HeatMetric value={heat} badge />
          <span className="text-xs font-medium text-white/80">
            📍 {location === "Global" ? "Global" : `${location}, United Kingdom`}
          </span>
        </div>
        {categoryName ? (
          <span className="mb-2 inline-block rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-ink">
            ✦ {categoryName}
          </span>
        ) : null}
        <h3 className="line-clamp-2 max-w-[420px] text-[24px] font-bold leading-tight tracking-tight">
          {ranking.title}
        </h3>
        {ranking.description ? (
          <p className="mt-2 line-clamp-2 max-w-[440px] text-sm text-white/75">
            {ranking.description}
          </p>
        ) : null}
        <div className="mt-4">
          <CandidateAvatarStrip
            nominees={topNominees}
            total={nomineeCount}
            size={38}
            showCount={5}
          />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-[13px] font-medium text-white/85">
            {nomineeCount === 0 ? (
              <span>✨ Nominees coming soon</span>
            ) : (
              <span>👥 {nomineeCount} nominees</span>
            )}
            <OrganicLikeMetric value={organicLikes} />
          </div>
          <span
            className="shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold text-white"
            style={{
              background: "linear-gradient(135deg, #7B4DFF, #4285F4)",
            }}
          >
            View ranking <span aria-hidden="true">→</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
