import Link from "next/link";
import type { Ranking } from "@/lib/types";

export default function RankingCard({ ranking }: { ranking: Ranking }) {
  return (
    <Link
      href={`/rankings/${ranking.id}`}
      className="block rounded-xl border border-border p-5 transition hover:border-ink"
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-subtle">
        {ranking.city}, {ranking.country}
      </p>
      <h3 className="mt-1 text-base font-semibold tracking-tight text-ink">
        {ranking.title}
      </h3>
      {ranking.description && (
        <p className="mt-1.5 line-clamp-2 text-sm text-subtle">
          {ranking.description}
        </p>
      )}
    </Link>
  );
}
