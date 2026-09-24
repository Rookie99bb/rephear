import Link from "next/link";
import {
  listNewestRankings,
  listTrendingRankings,
  listTrendingRankingsForCountry,
} from "@/db/rankings";
import RankingCard from "@/components/RankingCard";
import CountryFlagBar from "@/components/CountryFlagBar";
import { getCurrentFullUser } from "@/lib/session";
import { getCountryForCity } from "@/lib/locations";

export default async function HomePage() {
  const user = await getCurrentFullUser();
  const city = user?.location ?? undefined;
  const country = city ? getCountryForCity(city) : undefined;

  // Priority order matches how location-first browsing should feel: your
  // city first, then the rest of your country, and only then the global
  // list. countryTrending excludes the user's own city so it never just
  // repeats the section above it.
  // city-only when we actually have one — otherwise this would just
  // duplicate globalTrending below while rendering a broken
  // "Trending in undefined" title.
  const cityTrending = city ? await listTrendingRankings(4, city) : [];
  const countryTrending = country
    ? await listTrendingRankingsForCountry(4, country, city)
    : [];
  const globalTrending = await listTrendingRankings(4);
  const newest = await listNewestRankings(4, city);
  // London-first: the site is London-only for the MVP, so always present
  // the London rankings directly instead of a region picker.
  const londonRankings = await listNewestRankings(8, "London");

  if (
    globalTrending.length === 0 &&
    newest.length === 0 &&
    londonRankings.length === 0
  ) {
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
      <CountryFlagBar currentCountry={country} />

      {cityTrending.length > 0 && (
        <Section title={`Trending in ${city}`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {cityTrending.map((r) => (
              <RankingCard key={r.id} ranking={r} />
            ))}
          </div>
        </Section>
      )}

      {countryTrending.length > 0 && (
        <Section title={`Popular in ${country}`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {countryTrending.map((r) => (
              <RankingCard key={r.id} ranking={r} />
            ))}
          </div>
        </Section>
      )}

      {londonRankings.length > 0 && (
        <Section title="London Rankings">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {londonRankings.map((r) => (
              <RankingCard key={r.id} ranking={r} />
            ))}
          </div>
          <div className="mt-4">
            <Link
              href="/rankings"
              className="text-sm font-medium text-ink hover:opacity-80"
            >
              View all rankings →
            </Link>
          </div>
        </Section>
      )}

      {globalTrending.length > 0 && (
        <Section title="Global Trending">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {globalTrending.map((r) => (
              <RankingCard key={r.id} ranking={r} />
            ))}
          </div>
        </Section>
      )}

      {newest.length > 0 && (
        <Section title={city ? `Newest in ${city}` : "Newest Rankings"}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {newest.map((r) => (
              <RankingCard key={r.id} ranking={r} />
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
