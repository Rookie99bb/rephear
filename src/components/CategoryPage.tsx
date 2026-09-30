import Link from "next/link";
import { findCategoryBySlug, listCategories } from "@/db/categories";
import {
  listSubcategoriesByCategorySlug,
  countRankingsInSubcategory,
  listPublicRankingsByCategory,
  getAdjacentRankings,
} from "@/db/taxonomy";
import { getRankingCardStats } from "@/db/rankings";
import {
  getRisingRankings,
  getNewRankings,
  getMostLovedRankingIds,
} from "@/db/discovery";
import { getCurrentUser } from "@/lib/session";
import { isFollowing, countFollowers } from "@/db/follows";
import RankingCard from "@/components/RankingCard";
import CategoryBanner from "@/components/CategoryBanner";
import type { RankingBadge } from "@/lib/rankingDisplay";

// Category landing page (Taxonomy v2): /rankings/<category-slug>.
// Subcategory tabs (?sub=<subcategory-slug>) show only non-empty tabs —
// a tab with zero public rankings is never rendered. A genuinely empty
// subcategory shows the designed empty state plus "You might also like".
export default async function CategoryPage({
  categorySlug,
  activeSubSlug,
}: {
  categorySlug: string;
  activeSubSlug?: string;
}) {
  const category = await findCategoryBySlug(categorySlug);
  if (!category) return null;

  const [allSubs, user] = await Promise.all([
    listSubcategoriesByCategorySlug(categorySlug),
    getCurrentUser(),
  ]);
  const slugById = new Map(
    (await listCategories()).map((c) => [c.id, c.slug])
  );

  // Only non-empty tabs are shown (per-subcategory public counts).
  const subsWithCounts = await Promise.all(
    allSubs.map(async (s) => ({
      sub: s,
      count: await countRankingsInSubcategory(s.id),
    }))
  );
  const visibleSubs = subsWithCounts.filter((s) => s.count > 0);
  const activeSub = activeSubSlug
    ? visibleSubs.find((s) => s.sub.slug === activeSubSlug)?.sub ?? null
    : null;

  const rankings = await listPublicRankingsByCategory(category.id, {
    subcategoryId: activeSub?.id,
  });

  // Badges (same data-backed rule as the browse page): rising > new > most-loved.
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

  const [followingCategory, categoryFollowerCount, adjacent] =
    await Promise.all([
      user ? isFollowing(user.id, "category", category.id) : false,
      countFollowers("category", category.id),
      rankings.length === 0
        ? getAdjacentRankings(categorySlug, { limit: 3 })
        : Promise.resolve([]),
    ]);

  // Card stats cover both the main grid and the "You might also like"
  // recommendations (batched, never N+1).
  const stats = await getRankingCardStats(
    [...rankings, ...adjacent].map((r) => r.id)
  );

  const basePath = `/rankings/${category.slug}`;

  return (
    <div>
      <Link
        href="/rankings"
        className="mb-3 inline-block text-sm font-medium text-ink hover:opacity-80"
      >
        ← All rankings
      </Link>
      <CategoryBanner
        category={category}
        followerCount={categoryFollowerCount}
        following={followingCategory}
        loggedIn={!!user}
      />

      {/* Subcategory tabs — only non-empty ones are rendered. */}
      {visibleSubs.length > 0 && (
        <nav
          aria-label={`${category.name} subcategories`}
          className="mb-6 flex gap-2 overflow-x-auto pb-1"
        >
          <Link
            href={basePath}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
              !activeSub
                ? "bg-ink text-white"
                : "bg-[#f4f2fa] text-ink hover:bg-[#eae6f5]"
            }`}
          >
            All
          </Link>
          {visibleSubs.map(({ sub, count }) => (
            <Link
              key={sub.id}
              href={`${basePath}?sub=${sub.slug}`}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                activeSub?.id === sub.id
                  ? "bg-ink text-white"
                  : "bg-[#f4f2fa] text-ink hover:bg-[#eae6f5]"
              }`}
            >
              {sub.name}
              <span className="ml-1.5 text-xs opacity-60">{count}</span>
            </Link>
          ))}
        </nav>
      )}

      {rankings.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {rankings.map((r) => (
            <RankingCard
              key={r.id}
              ranking={r}
              badge={badgeFor(r.id)}
              categorySlug={category.slug}
              likeCount={stats[r.id]?.likeCount ?? 0}
              nomineeCount={stats[r.id]?.nomineeCount ?? 0}
            />
          ))}
        </div>
      ) : (
        <div>
          <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
            <p className="text-[15px] font-medium text-ink">
              Nothing here yet — be the first to start the conversation.
            </p>
            <Link
              href="/rankings/new"
              className="mt-4 inline-block rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              Create a ranking
            </Link>
          </div>
          {adjacent.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-subtle">
                You might also like
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {adjacent.map((r) => (
                  <RankingCard
                    key={r.id}
                    ranking={r}
                    badge={badgeFor(r.id)}
                    categorySlug={
                      r.categoryId ? slugById.get(r.categoryId) : undefined
                    }
                    likeCount={stats[r.id]?.likeCount ?? 0}
                    nomineeCount={stats[r.id]?.nomineeCount ?? 0}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
