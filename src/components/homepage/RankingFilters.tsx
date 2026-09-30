"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Category } from "@/lib/types";
import type { RegionCount } from "@/db/rankings";

// Homepage filter dropdowns. Changing a filter updates the homepage URL
// query params (?category= / ?city= / ?sort=); the server component
// ExploreRankings reads them and re-renders the card grid.
export default function RankingFilters({
  categories,
  regions,
  activeCategory,
  activeCity,
  activeSort,
}: {
  categories: Category[];
  regions: RegionCount[];
  activeCategory: string;
  activeCity: string;
  activeSort: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(key: "category" | "city" | "sort", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const selectCls =
    "rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink shadow-sm hover:border-brand/60 focus:border-brand focus:outline-none";

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <label className="sr-only" htmlFor="explore-category">
        Filter by category
      </label>
      <select
        id="explore-category"
        className={selectCls}
        value={activeCategory}
        onChange={(e) => update("category", e.target.value)}
      >
        <option value="">All Categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="explore-city">
        Filter by location
      </label>
      <select
        id="explore-city"
        className={selectCls}
        value={activeCity}
        onChange={(e) => update("city", e.target.value)}
      >
        <option value="">All Locations</option>
        {regions.map((r) => (
          <option key={`${r.country}|${r.city}`} value={r.city}>
            {r.city}
            {r.city.toLowerCase() === "global" ? "" : `, ${r.country}`}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="explore-sort">
        Sort rankings
      </label>
      <select
        id="explore-sort"
        className={selectCls}
        value={activeSort}
        onChange={(e) => update("sort", e.target.value)}
      >
        <option value="trending">Trending</option>
        <option value="newest">Newest</option>
      </select>
    </div>
  );
}
