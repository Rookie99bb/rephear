import Link from "next/link";
import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { searchRankings, getRankingCardStats } from "@/db/rankings";
import { listCategories } from "@/db/categories";
import {
  getRisingRankings,
  getNewRankings,
  getMostLovedRankingIds,
} from "@/db/discovery";
import { countPublicRankingsByCategory, TAXONOMY } from "@/db/taxonomy";
import { CATEGORY_REDIRECTS } from "@/db/taxonomy";
import { findCategoryBySlug } from "@/db/categories";
import RankingCard from "@/components/RankingCard";
import RankingsTabs from "@/components/RankingsTabs";
import DiscoverySections from "@/components/DiscoverySections";
import NotificationBell from "@/components/NotificationBell";
import type { RankingBadge } from "@/lib/rankingDisplay";
import type { Ranking } from "@/lib/types";

export const metadata: Metadata = {
  title: "Rankings",
  description:
    "Browse public reputation Rankings on RepHear — anime, manga, gaming, cosplay, music and more.",
  alternates: { canonical: "/rankings" },
};

// Taxonomy v2 (2026-09-30): the Rankings home is a discovery surface, not
// a database directory. Navigation is the tab bar (For You / Anime /
// Gaming / Manga / Cosplay / Creators / Music / More); each category has
// its own landing page at /rankings/<category-slug>.
// ?q= searches titles/descriptions. Legacy ?category=<slug> links 301 to
// the new canonical category paths (SEO preservation).
export default async function BrowseRankingsPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string };
}) {
  const query = searchParams.q?.trim();
  const categoryParam = searchParams.category?.trim();

  // Legacy category URLs → 301 to the new taxonomy paths. A current v2
  // slug also redirects to its canonical path. Unknown slugs fall
  // through to the default discovery view (never a dead end).
  if (categoryParam && !query) {
    const legacyTarget = CATEGORY_REDIRECTS[categoryParam];
    if (legacyTarget) permanentRedirect(`/rankings/${legacyTarget}`);
    const current = await findCategoryBySlug(categoryParam);
    if (current) permanentRedirect(`/rankings/${current.slug}`);
  }

  const rankings: Ranking[] = query ? await searchRankings(query) : [];

  // Badge sets (data-backed, one primary badge per card): rising (7d
  // activity) > new (created <30d) > most-loved (all-time likes).
  const [rising, fresh, mostLovedIds] = await Promise.all([
    getRisingRankings(12),
    getNewRankings(50),
    getMostLovedRankingIds(8),
  ]);
  const risingIds = new Set(rising.map((r) => r.ranking.id));
  const newIds = new Set(fresh.map((r) => r.id));
  const mostLovedIdSet = new Set(mostLovedIds);
  const badgeFor = (id: string): RankingBadge | undefined => {
    if (risingIds.has(id)) return "rising";
    if (newIds.has(id)) return "new";
    if (mostLovedIdSet.has(id)) return "most-loved";
    return undefined;
  };

  // Card stats (likes + nominees) in one batched query — never N+1.
  const stats = await getRankingCardStats(rankings.map((r) => r.id));

  // Category browse grid: the 13 primary categories in canonical order,
  // each with its live public ranking count. Categories resolve by slug
  // so this never shows a retired legacy category.
  const categories = await listCategories();
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));
  const browseCategories = (
    await Promise.all(
      TAXONOMY.map(async (seed) => {
        const category = categoryBySlug.get(seed.slug);
        if (!category) return null;
        return {
          ...category,
          count: await countPublicRankingsByCategory(category.id),
        };
      })
    )
  ).filter((c) => c !== null);

  const renderCard = (r: Ranking, slug?: string | null) => (
    <RankingCard
      key={r.id}
      ranking={r}
      badge={badgeFor(r.id)}
      categorySlug={slug}
      likeCount={stats[r.id]?.likeCount ?? 0}
      nomineeCount={stats[r.id]?.nomineeCount ?? 0}
    />
  );

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

      <RankingsTabs />

      <form action="/rankings" method="GET" className="mb-6">
        <input
          type="search"
          name="q"
          defaultValue={query ?? ""}
          placeholder="Search Rankings by title or description…"
          className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-ink"
        />
      </form>

      {query ? (
        rankings.length === 0 ? (
          <p className="text-sm text-subtle">
            No Rankings match &ldquo;{query}&rdquo;.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {rankings.map((r) => renderCard(r))}
          </div>
        )
      ) : (
        <div>
          {/* Phase 3 (§22): discovery surfaces on the default browse view
              only (not search results). */}
          <DiscoverySections badgeFor={badgeFor} stats={stats} />

          <section aria-label="Browse by category">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-subtle">
              Browse by category
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {browseCategories.map((c) => (
                <Link
                  key={c.id}
                  href={`/rankings/${c.slug}`}
                  className="group rounded-2xl border border-[#E5E5E5] bg-white p-4 transition hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[15px] font-semibold tracking-tight text-ink group-hover:underline">
                      {c.name}
                    </h3>
                    <span
                      aria-hidden
                      className="text-subtle transition group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-subtle">
                    {c.count} {c.count === 1 ? "ranking" : "rankings"}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
