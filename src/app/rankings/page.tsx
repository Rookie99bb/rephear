import Link from "next/link";
import { listAllRankings, searchRankingsByRegion } from "@/db/rankings";
import RankingCard from "@/components/RankingCard";

export default function BrowseRankingsPage({
  searchParams,
}: {
  searchParams: { country?: string; city?: string };
}) {
  const { country, city } = searchParams;
  const isFiltered = !!(country || city);
  const rankings = isFiltered
    ? searchRankingsByRegion({ country, city })
    : listAllRankings();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            Rankings
          </h1>
          {isFiltered && (
            <p className="mt-1 text-sm text-subtle">
              Filtered by {[city, country].filter(Boolean).join(", ")} —{" "}
              <Link href="/rankings" className="underline">
                clear filter
              </Link>
            </p>
          )}
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
          {isFiltered ? (
            "No Rankings in this region yet."
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
