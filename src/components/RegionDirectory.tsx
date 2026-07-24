import Link from "next/link";
import type { CountryInfo } from "@/lib/locations";

// The region discovery directory shown on /rankings when browsing "All
// Regions" or a single country with no city picked yet — every
// configured MVP city is listed here, grouped by country, even ones with
// zero Rankings. Clicking a city always goes to /rankings?country=&city=
// for that exact city, which then shows either its Rankings or an empty
// state with a "Create the first ranking" call to action — a city never
// just disappears because nothing has been posted there yet.
export default function RegionDirectory({
  countries,
  cityCounts,
}: {
  countries: CountryInfo[];
  cityCounts: Record<string, number>;
}) {
  return (
    <div className="space-y-8">
      {countries.map((c) => (
        <div key={c.country}>
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-subtle">
            <span className="text-base leading-none">{c.flag}</span>
            {c.country}
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {c.cities.map((city) => {
              const count = cityCounts[city] ?? 0;
              return (
                <Link
                  key={city}
                  href={`/rankings?country=${encodeURIComponent(c.country)}&city=${encodeURIComponent(city)}`}
                  className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm transition hover:border-ink"
                >
                  <span className="font-medium text-ink">{city}</span>
                  <span className="text-subtle">
                    {count} {count === 1 ? "Ranking" : "Rankings"}{" "}
                    <span aria-hidden>→</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
