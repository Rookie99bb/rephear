import { listRankingsForAdmin } from "@/db/rankings";
import { listCountries, getCitiesForCountry } from "@/lib/locations";
import { listCategories } from "@/db/categories";
import { listAllSubcategories, TAXONOMY } from "@/db/taxonomy";
import AdminRankingsBoard from "@/components/AdminRankingsBoard";
import Link from "next/link";

export default async function AdminRankingsPage({
  searchParams,
}: {
  searchParams: {
    country?: string;
    city?: string;
    visibility?: string; // "visible" | "hidden"
    pin?: string; // "pinned" | "unpinned"
    category?: string; // category id (taxonomy v2)
    scope?: string; // "global" | "city"
  };
}) {
  const { country, city, visibility, pin, category, scope } = searchParams;

  const rankings = await listRankingsForAdmin({
    country: country || undefined,
    city: city || undefined,
    hidden: visibility === "hidden" ? true : visibility === "visible" ? false : undefined,
    pinned: pin === "pinned" ? true : pin === "unpinned" ? false : undefined,
    categoryId: category || undefined,
    scope: scope === "global" || scope === "city" ? scope : undefined,
  });

  // Grouped by city so drag-and-drop can never cross a city boundary —
  // each group below becomes its own independent draggable list on the
  // client, and reorderRankingsAction() is always called with that one
  // group's city, never the whole filtered set.
  const groupsByCity = new Map<string, { city: string; country: string; rankings: typeof rankings }>();
  for (const ranking of rankings) {
    const existing = groupsByCity.get(ranking.city);
    if (existing) {
      existing.rankings.push(ranking);
    } else {
      groupsByCity.set(ranking.city, {
        city: ranking.city,
        country: ranking.country,
        rankings: [ranking],
      });
    }
  }
  const groups = Array.from(groupsByCity.values()).sort((a, b) =>
    a.city.localeCompare(b.city)
  );

  const countries = listCountries();
  const cityOptions = country ? getCitiesForCountry(country) : [];
  const hasFilters = !!(country || city || visibility || pin || category || scope);
  // Taxonomy v2: category filter shows only the 13 canonical primary
  // categories (never retired legacy rows).
  const allCategories = await listCategories();
  const taxonomyCategories = TAXONOMY.map((seed) =>
    allCategories.find((c) => c.slug === seed.slug)
  ).filter((c) => c !== undefined);
  const categorySlugs = Object.fromEntries(
    allCategories.map((c) => [c.id, c.slug])
  );
  const categoryNames = Object.fromEntries(
    allCategories.map((c) => [c.id, c.name])
  );
  const allSubcategories = await listAllSubcategories();
  const subcategoryNames = Object.fromEntries(
    allSubcategories.map((s) => [s.id, s.name])
  );

  return (
    <div>
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-subtle">
        Rankings
      </h2>
      <p className="mb-4 text-xs text-subtle">
        Control which Rankings are publicly visible, which are pinned to the
        top of their city, and the order they appear in. Hiding a Ranking
        never deletes it — it stays fully visible and editable here.
      </p>

      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-border p-4 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink">Country</span>
          <select
            name="country"
            defaultValue={country || ""}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs"
          >
            <option value="">All countries</option>
            {countries.map((c) => (
              <option key={c.country} value={c.country}>
                {c.flag} {c.country}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink">City</span>
          <select
            name="city"
            defaultValue={city || ""}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs"
          >
            <option value="">All cities</option>
            {(country ? cityOptions : []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink">Visibility</span>
          <select
            name="visibility"
            defaultValue={visibility || ""}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs"
          >
            <option value="">All</option>
            <option value="visible">Visible</option>
            <option value="hidden">Hidden</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink">Pin status</span>
          <select
            name="pin"
            defaultValue={pin || ""}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs"
          >
            <option value="">All</option>
            <option value="pinned">Pinned</option>
            <option value="unpinned">Unpinned</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink">Category</span>
          <select
            name="category"
            defaultValue={category || ""}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs"
          >
            <option value="">All categories</option>
            {taxonomyCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink">Scope</span>
          <select
            name="scope"
            defaultValue={scope || ""}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs"
          >
            <option value="">All scopes</option>
            <option value="global">🌍 Global</option>
            <option value="city">📍 City</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
        >
          Filter
        </button>
        {hasFilters && (
          <Link href="/admin/rankings" className="text-xs text-subtle underline">
            Clear filters
          </Link>
        )}
      </form>

      {groups.length === 0 ? (
        <p className="text-sm text-subtle">No Rankings match these filters.</p>
      ) : (
        <AdminRankingsBoard
          groups={groups}
          categorySlugs={categorySlugs}
          categoryNames={categoryNames}
          subcategoryNames={subcategoryNames}
          taxonomyCategories={taxonomyCategories.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            subcategories: allSubcategories
              .filter((s) => s.categoryId === c.id)
              .map((s) => ({ id: s.id, name: s.name, slug: s.slug })),
          }))}
        />
      )}
    </div>
  );
}
