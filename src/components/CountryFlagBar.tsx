import Link from "next/link";
import { listCountries } from "@/lib/locations";

// Homepage-top navigation: one flag per country, always the same fixed
// set (derived from LOCATIONS, so it always matches real Rankings), plus
// one "All Regions" pill so every Ranking is reachable in one click —
// regardless of the visitor's own location — instead of only ever
// showing a single country at a time. Clicking a flag (or "All Regions")
// takes you to the Rankings page filtered accordingly — reuses the
// existing /rankings?country=/?all= filters rather than inventing a
// second, homepage-only browsing mechanism.
export default function CountryFlagBar({
  currentCountry,
  showingAll = false,
}: {
  currentCountry?: string;
  showingAll?: boolean;
}) {
  const countries = listCountries();

  return (
    <div className="flex flex-wrap gap-2 border-b border-border pb-6">
      <Link
        href="/rankings?all=1"
        title="All Regions"
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
          showingAll
            ? "border-ink bg-ink text-white"
            : "border-border text-ink hover:border-ink"
        }`}
      >
        <span className="text-base leading-none">🌍</span>
        <span>All Regions</span>
      </Link>
      {countries.map((c) => {
        const isCurrent = !showingAll && c.country === currentCountry;
        return (
          <Link
            key={c.country}
            href={`/rankings?country=${encodeURIComponent(c.country)}`}
            title={c.country}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              isCurrent
                ? "border-ink bg-ink text-white"
                : "border-border text-ink hover:border-ink"
            }`}
          >
            <span className="text-base leading-none">{c.flag}</span>
            <span>{c.country}</span>
          </Link>
        );
      })}
    </div>
  );
}
