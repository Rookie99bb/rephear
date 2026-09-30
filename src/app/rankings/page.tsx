import Link from "next/link";
import type { Metadata } from "next";
import { listAllRankings, searchRankings } from "@/db/rankings";
import { findCategoryBySlug, listCategories } from "@/db/categories";
import { getCurrentUser } from "@/lib/session";
import { isFollowing } from "@/db/follows";
import RankingCard from "@/components/RankingCard";
import DiscoverySections from "@/components/DiscoverySections";
import NotificationBell from "@/components/NotificationBell";
import CategoryPageView from "@/components/category/CategoryPageView";
import {
  listCategoryRankingsWithStats,
  listSubcategoriesWithCounts,
} from "@/db/categoryPage";
import type { Ranking } from "@/lib/types";

export const metadata: Metadata = {
  title: "Rankings",
  description:
    "Browse public reputation Rankings on RepHear — see who's leading in London.",
  alternates: { canonical: "/rankings" },
};

// London-only MVP: this page lists every ranking directly — no region
// picker, no per-account city default, no directory views. A search
// (?q=) filters by title/description and takes priority. A category
// (?category=<slug>, linked from homepage category cards) renders the
// redesigned visual category page (CategoryPageView); an optional
// ?sub=<subcategory-slug|all> filters it further.
export default async function BrowseRankingsPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; sub?: string };
}) {
  const query = searchParams.q?.trim();
  const categorySlug = searchParams.category?.trim();
  const subParam = searchParams.sub?.trim() || null;
  const rankings: Ranking[] = query
    ? await searchRankings(query)
    : await listAllRankings();

  // Group the flat Ranking list by parent Category, if any of it has
  // one. Most rankings are uncategorised, in which case categoryGroups
  // is simply empty and rendering falls straight through to the flat
  // grid, unchanged. Skipped for search results, where grouping by
  // category isn't meaningful.
  let categoryGroups: { id: string; name: string; rankings: Ranking[] }[] = [];
  let uncategorizedRankings: Ranking[] = rankings;
  // Homepage category cards link here with ?category=<slug>: render the
  // redesigned visual category page. A search (?q=) narrows to matching
  // rankings inside the category instead of dropping the category view.
  const activeCategory = categorySlug
    ? await findCategoryBySlug(categorySlug)
    : null;
  // Phase 3 (§19): category-follow state for the signed-in user.
  const user = await getCurrentUser();
  const followingCategory =
    user && activeCategory
      ? await isFollowing(user.id, "category", activeCategory.id)
      : false;

  if (activeCategory) {
    const inCategoryIds = new Set(
      rankings.filter((r) => r.categoryId === activeCategory.id).map((r) => r.id)
    );
    const allStats = await listCategoryRankingsWithStats(activeCategory.id);
    const stats = allStats.filter((s) => inCategoryIds.has(s.ranking.id));
    const subcategories = await listSubcategoriesWithCounts(activeCategory.id);
    const activeSubName =
      subParam && subParam !== "all"
        ? (subcategories.find((s) => s.slug === subParam)?.name ?? null)
        : null;
    return (
      <CategoryPageView
        category={activeCategory}
        stats={stats}
        subcategories={subcategories}
        activeSub={subParam}
        activeSubName={activeSubName}
        query={query ?? null}
        following={followingCategory}
        loggedIn={!!user}
      />
    );
  }
  if (!query && rankings.length > 0 && !activeCategory) {
    const categories = await listCategories();
    const rankingsByCategory = new Map<string, Ranking[]>();
    const leftover: Ranking[] = [];
    for (const r of rankings) {
      if (r.categoryId) {
        const arr = rankingsByCategory.get(r.categoryId) ?? [];
        arr.push(r);
        rankingsByCategory.set(r.categoryId, arr);
      } else {
        leftover.push(r);
      }
    }
    categoryGroups = categories
      .filter((c) => rankingsByCategory.has(c.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        rankings: rankingsByCategory.get(c.id)!,
      }));
    uncategorizedRankings = leftover;
  }

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
          ) : null}
        </div>
        <Link
          href="/rankings/new"
          className="shrink-0 rounded-xl bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Create Ranking
        </Link>
        {/* Phase 3: notification bell (global header is owned by the
            in-flight homepage redesign; mounted here + /u/[id] for now). */}
        <NotificationBell />
      </div>

      <form action="/rankings" method="GET" className="mb-6">
        <input
          type="search"
          name="q"
          defaultValue={query ?? ""}
          placeholder="Search Rankings by title or description…"
          className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-ink"
        />
      </form>

      {/* Phase 3 (§22): discovery surfaces on the default browse view
          only (not search views). */}
      {!query && <DiscoverySections />}

      {rankings.length === 0 ? (
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
      ) : categoryGroups.length > 0 ? (
        <div className="flex flex-col gap-8">
          {categoryGroups.map((group) => (
            <div key={group.id}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-subtle">
                {group.name}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {group.rankings.map((r) => (
                  <RankingCard key={r.id} ranking={r} />
                ))}
              </div>
            </div>
          ))}
          {uncategorizedRankings.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-subtle">
                All Rankings
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {uncategorizedRankings.map((r) => (
                  <RankingCard key={r.id} ranking={r} />
                ))}
              </div>
            </div>
          )}
        </div>
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
