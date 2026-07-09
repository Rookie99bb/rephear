import Link from "next/link";
import {
  listNewestRankings,
  listTrendingRankings,
  listPopularRegions,
} from "@/db/rankings";
import RankingCard from "@/components/RankingCard";

export default function HomePage() {
  const trending = listTrendingRankings(4);
  const newest = listNewestRankings(4);
  const regions = listPopularRegions(6);

  if (trending.length === 0 && newest.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          RepHear
        </h1>
        <p className="max-w-md text-sm text-subtle">
          An open public ranking platform. Be the first to create a Ranking
          and start building public reputation together.
        </p>
        <Link
          href="/rankings/new"
          className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Create the first Ranking
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      <Section title="Trending Rankings">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {trending.map((r) => (
            <RankingCard key={r.id} ranking={r} />
          ))}
        </div>
      </Section>

      <Section title="Newest Rankings">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {newest.map((r) => (
            <RankingCard key={r.id} ranking={r} />
          ))}
        </div>
      </Section>

      {regions.length > 0 && (
        <Section title="Popular Regions">
          <div className="flex flex-wrap gap-2">
            {regions.map((region) => (
              <Link
                key={`${region.country}-${region.city}`}
                href={`/rankings?country=${encodeURIComponent(region.country)}${region.city ? `&city=${encodeURIComponent(region.city)}` : ""}`}
                className="rounded-full border border-border px-3 py-1.5 text-sm text-ink transition hover:border-ink"
              >
                {region.city ? `${region.city}, ${region.country}` : region.country}
                <span className="ml-1.5 text-subtle">
                  {region.rankingCount}
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-subtle">
        {title}
      </h2>
      {children}
    </section>
  );
}
