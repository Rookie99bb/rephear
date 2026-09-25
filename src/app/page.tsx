import Link from "next/link";
import {
  listNewestRankings,
  listRankingsBySlugs,
  listTrendingRankings,
} from "@/db/rankings";
import { findCategoryBySlug } from "@/db/categories";
import type { Category, Ranking } from "@/lib/types";
import RankingCard from "@/components/RankingCard";
import CategoryCard from "@/components/CategoryCard";

// Curated homepage lineup (set 2026-09-25): a mix of individual rankings
// and category sections, in this exact order. Missing, hidden, or
// soft-deleted entries are skipped at render time.
const HOMEPAGE_SPOTS: ReadonlyArray<
  { kind: "ranking"; slug: string } | { kind: "category"; slug: string }
> = [
  { kind: "ranking", slug: "best-international-student-community-london-2026" },
  { kind: "category", slug: "cosplay" },
  { kind: "ranking", slug: "best-university-society-london-2026" },
  { kind: "category", slug: "underground-rap" },
  { kind: "ranking", slug: "best-emerging-beauty-creator-london-2026" },
  { kind: "category", slug: "kpop-dance" },
  { kind: "ranking", slug: "most-popular-livestream-dj-london-2026" },
  { kind: "ranking", slug: "best-society-president-london-2026" },
  { kind: "ranking", slug: "most-popular-student-performer-london-2026" },
];

type HomepageSpot =
  | { type: "ranking"; ranking: Ranking }
  | { type: "category"; category: Category };

export default async function HomePage() {
  // London-only for the MVP: present the London rankings directly.
  // No region picker, no per-account location sections, and empty
  // sections are never rendered — not even their titles.
  const featuredRankings = await listRankingsBySlugs(
    HOMEPAGE_SPOTS.filter((s) => s.kind === "ranking").map((s) => s.slug)
  );
  const featuredCategories = (
    await Promise.all(
      HOMEPAGE_SPOTS.filter((s) => s.kind === "category").map((s) =>
        findCategoryBySlug(s.slug)
      )
    )
  ).filter((c): c is Category => c !== null);
  const rankingBySlug = new Map(featuredRankings.map((r) => [r.slug, r]));
  const categoryBySlug = new Map(featuredCategories.map((c) => [c.slug, c]));
  const londonSpots: HomepageSpot[] = HOMEPAGE_SPOTS.flatMap(
    (spot): HomepageSpot[] => {
      if (spot.kind === "ranking") {
        const ranking = rankingBySlug.get(spot.slug);
        return ranking ? [{ type: "ranking", ranking }] : [];
      }
      const category = categoryBySlug.get(spot.slug);
      return category ? [{ type: "category", category }] : [];
    }
  );
  const globalTrending = await listTrendingRankings(4);
  const newest = await listNewestRankings(4);

  if (
    globalTrending.length === 0 &&
    newest.length === 0 &&
    londonSpots.length === 0
  ) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          RepHear
        </h1>
        <p className="max-w-md text-sm text-subtle">
          An open public ranking platform. Be the first to create a Ranking
          and start building public reputation together.
        </p>
        <Link
          href="/rankings/new"
          className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Create the first Ranking
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      {londonSpots.length > 0 && (
        <Section title="London Rankings">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {londonSpots.map((spot) =>
              spot.type === "ranking" ? (
                <RankingCard key={spot.ranking.id} ranking={spot.ranking} />
              ) : (
                <CategoryCard key={spot.category.id} category={spot.category} />
              )
            )}
          </div>
          <div className="mt-4">
            <Link
              href="/rankings"
              className="text-sm font-medium text-ink hover:opacity-80"
            >
              View all rankings →
            </Link>
          </div>
        </Section>
      )}

      {globalTrending.length > 0 && (
        <Section title="Global Trending">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {globalTrending.map((r) => (
              <RankingCard key={r.id} ranking={r} />
            ))}
          </div>
        </Section>
      )}

      {newest.length > 0 && (
        <Section title="Newest Rankings">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {newest.map((r) => (
              <RankingCard key={r.id} ranking={r} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-subtle">
        {title}
      </h2>
      {children}
    </section>
  );
}
