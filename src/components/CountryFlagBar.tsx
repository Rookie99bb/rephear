import Link from "next/link";
import { listCountries } from "@/lib/locations";

// Homepage-top navigation: one flag per country, always the same fixed
// set (derived from LOCATIONS, so it always matches real Rankings).
// Clicking a flag takes you to the Rankings page filtered to that
// country — reuses the existing /rankings?country= filter rather than
// inventing a second, homepage-only browsing mechanism.
export default function CountryFlagBar({
  currentCountry,
}: {
  currentCountry?: string;
}) {
  const countries = listCountries();

  return (
    <div className="flex flex-wrap gap-2 border-b border-border pb-6">
      {countries.map((c) => {
        const isCurrent = c.country === currentCountry;
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
