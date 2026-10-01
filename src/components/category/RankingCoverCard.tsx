import Link from "next/link";
import RankingCover from "@/components/homepage/RankingCover";
import HeatMetric from "@/components/rankings/HeatMetric";
import OrganicLikeMetric from "@/components/rankings/OrganicLikeMetric";
import { type CategoryRankingStat } from "@/db/categoryPage";

const RANK_BADGE: Record<number, string> = {
  1: "bg-[#FFC531] text-ink",
  2: "bg-[#E8E8EC] text-ink",
  3: "bg-[#E8A87C] text-ink",
};

// Visual-first ranking card: 3:2 cover image on top, compact info below.
// Cover priority: ranking cover image -> top nominee photo -> branded
// gradient with initials (handled inside RankingCover; never broken).
export default function RankingCoverCard({
  stat,
  rank,
}: {
  stat: CategoryRankingStat;
  rank?: number;
}) {
  const { ranking } = stat;
  return (
    <Link
      href={`/rankings/${ranking.id}`}
      className="group block overflow-hidden rounded-xl border border-border bg-white transition hover:border-ink"
    >
      <div className="relative aspect-[3/2] overflow-hidden">
        <RankingCover
          coverUrl={ranking.coverImageUrl}
          coverAlt={ranking.coverImageAlt}
          photoUrl={stat.topNomineePhoto}
          nomineeName={stat.topNomineeName}
          avatarColor={stat.topNomineeColor}
          rankingTitle={ranking.title}
          variant="fill"
        />
        <div className="absolute right-2.5 top-2.5">
          <HeatMetric value={stat.totalLikes} badge />
        </div>
        {rank != null ? (
          <span
            className={`absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-xs font-bold ${RANK_BADGE[rank] ?? "bg-white/90 text-ink"}`}
          >
            #{rank}
          </span>
        ) : null}
      </div>
      <div className="px-4 py-3">
        <h3 className="truncate text-[15px] font-semibold tracking-tight text-ink">
          {ranking.title}
        </h3>
        {ranking.description ? (
          <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-[13px] leading-snug text-subtle">
            {ranking.description}
          </p>
        ) : null}
        <p className="mt-2 flex flex-wrap items-center gap-3 text-[13px] text-subtle">
          {stat.nomineeCount === 0 ? (
            <span>✨ Nominees coming soon</span>
          ) : (
            <span>👥 {stat.nomineeCount} nominees</span>
          )}
          <OrganicLikeMetric value={stat.organicLikes} />
        </p>
      </div>
    </Link>
  );
}
