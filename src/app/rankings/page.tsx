import Link from "next/link";
import {
  listAllRankings,
  searchRankingsByRegion,
  searchRankings,
  getRankingCountsByCity,
} from "@/db/rankings";
import RankingCard from "@/components/RankingCard";
import CountryFlagBar from "@/components/CountryFlagBar";
import RegionDirectory from "@/components/RegionDirectory";
import { listCountries } from "@/lib/locations";
import { getCurrentFullUser } from "@/lib/session";

// Rankings are location-first by default: with no explicit filter, this
// page shows only the current user's chosen location — never a mix of
// cities from all over the world.
//
// Browsing beyond your own city is a two-step directory, not a flat
// dump of every Ranking on earth: picking "All Regions" (?all=1) or a
// single country (?country=) first shows every configured MVP city in
// that scope — see src/lib/locations.ts for the full 22-city list —
// grouped by country, with a Ranking count per city (including cities
// with 0 Rankings, which must stay discoverable, not hidden). Only once
// a specific city is picked (?city=, always paired with its ?country=)
// do we actually show that city's Rankings, or an empty state inviting
// someone to create the first one. A search (?q=) takes priority over
// all of the above — it deliberately searches every open country, since
// someone searching by name/topic wants to find a Ranking regardless of
// where it's based.
export default async function BrowseRankingsPage({
  searchParams,
}: {
  searchParams: { country?: string; city?: string; q?: string; all?: string };
}) {
  const { country, city, q, all } = searchParams;
  const query = q?.trim();
  const hasCityFilter = !!city;

  // "All Regions" directory: every country, every configured city.
  const showAllDirectory =
    !country && !hasCityFilter && !query && (all === "1" || all === "true");
  // Single-country directory: just that country's configured cities.
  const isCountryDirectory = !!country && !hasCityFilter && !query;
  const isDirectory = showAllDirectory || isCountryDirectory;

  const user = await getCurrentFullUser();
  const defaultCity = user?.location ?? null;

  let rankings: Awaited<ReturnType<typeof listAllRankings>> = [];
  let cityCounts: Record<string, number> = {};

  if (isDirectory) {
    cityCounts = await getRankingCountsByCity();
  } else {
    rankings = query
      ? await searchRankings(query)
      : hasCityFilter
        ? await searchRankingsByRegion({ country, city })
        : defaultCity
          ? await searchRankingsByRegion({ city: defaultCity })
          : await listAllRankings();
  }

  const directoryCountries = isCountryDirectory
    ? listCountries().filter((c) => c.country === country)
    : listCountries();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            Rankings
          </h1>
          {query ? (
            <p className="mt-1 text-sm text-subtle">
              Search results for &ldquo;{query}&rdquo;
              {" — "}
              <Link href="/rankings" className="underline">
                clear search
              </Link>
            </p>
          ) : showAllDirectory ? (
            <p className="mt-1 text-sm text-subtle">
              Browse all 22 regions across the United Kingdom, United
              States, and Canada.
              {defaultCity && (
                <>
                  {" — "}
                  <Link href="/rankings" className="underline">
                    back to {defaultCity}
                  </Link>
                </>
              )}
            </p>
          ) : isCountryDirectory ? (
            <p className="mt-1 text-sm text-subtle">
              Browsing {country}
              {" — "}
              <Link href="/rankings?all=1" className="underline">
                view all regions
              </Link>
              {defaultCity && (
                <>
                  {" · "}
                  <Link href="/rankings" className="underline">
                    back to {defaultCity}
                  </Link>
                </>
              )}
            </p>
          ) : hasCityFilter ? (
            <p className="mt-1 text-sm text-subtle">
              Filtered by {[city, country].filter(Boolean).join(", ")}
              {" — "}
              <Link href="/rankings?all=1" className="underline">
                view all regions
              </Link>
              {defaultCity && (
                <>
                  {" · "}
                  <Link href="/rankings" className="underline">
                    back to {defaultCity}
                  </Link>
                </>
              )}
            </p>
          ) : defaultCity ? (
            <p className="mt-1 text-sm text-subtle">Showing {defaultCity}</p>
          ) : null}
        </div>
        <Link
          href="/rankings/new"
          className="shrink-0 rounded-xl bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Create Ranking
        </Link>
      </div>

      <CountryFlagBar currentCountry={country} showingAll={showAllDirectory} />

      <form action="/rankings" method="GET" className="mb-6 mt-6">
        <input
          type="search"
          name="q"
          defaultValue={query ?? ""}
          placeholder="Search Rankings by title or description…"
          className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-ink"
        />
      </form>

      {isDirectory ? (
        <RegionDirectory countries={directoryCountries} cityCounts={cityCounts} />
      ) : rankings.length === 0 ? (
        query ? (
          <p className="text-sm text-subtle">
            No Rankings match &ldquo;{query}&rdquo;.
          </p>
        ) : (
          <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
            <p className="text-sm text-subtle">
              No rankings here yet. Be the first to start recognition in
              your community.
            </p>
            <Link
              href="/rankings/new"
              className="mt-4 inline-block rounded-xl bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Create the first ranking
            </Link>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {rankings.map((r) => (
            <RankingCard key={r.id} ranking={r} />
          ))}
        </div>
      )}
    </div>
  );
}
