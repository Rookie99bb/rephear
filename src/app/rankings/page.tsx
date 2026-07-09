import Link from "next/link";
import { listAllRankings, searchRankingsByRegion } from "@/db/rankings";
import RankingCard from "@/components/RankingCard";
import { getCurrentFullUser } from "@/lib/session";

// Rankings are location-first: with no explicit filter, this page shows
// only the current user's chosen location — never a mix of cities from
// all over the world. An explicit ?country=&city= (e.g. from a Popular
// Regions link) can still browse a different location on purpose.
export default async function BrowseRankingsPage({
  searchParams,
}: {
  searchParams: { country?: string; city?: string };
}) {
  const { country, city } = searchParams;
  const hasExplicitFilter = !!(country || city);

  const user = await getCurrentFullUser();
  const defaultCity = user?.location ?? null;

  const rankings = hasExplicitFilter
    ? searchRankingsByRegion({ country, city })
    : defaultCity
      ? searchRankingsByRegion({ city: defaultCity })
      : listAllRankings();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            Rankings
          </h1>
          {hasExplicitFilter ? (
            <p className="mt-1 text-sm text-subtle">
              Filtered by {[city, country].filter(Boolean).join(", ")}
              {defaultCity && (
                <>
                  {" — "}
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
          className="rounded-xl bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Create Ranking
        </Link>
      </div>
      {rankings.length === 0 ? (
        <p className="text-sm text-subtle">
          {hasExplicitFilter || defaultCity ? (
            "No Rankings in this location yet."
          ) : (
            <>
              No Rankings yet.{" "}
              <Link
                href="/rankings/new"
                className="font-medium text-ink hover:underline"
              >
                Create the first one
              </Link>
              .
            </>
          )}
        </p>
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
