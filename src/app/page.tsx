import Link from "next/link";
import { listNewestRankings, listRankingsBySlugs, listTrendingRankings } from "@/db/rankings";
import RankingCard from "@/components/RankingCard";

// Curated homepage lineup: Beauty Creators, DJs, schools, and societies.
const HOMEPAGE_FEATURED_SLUGS = [
  "most-popular-beauty-creator-london-2026",
  "best-student-dj-london-2026",
  "best-international-student-community-london-2026",
  "best-university-society-london-2026",
  "best-emerging-beauty-creator-london-2026",
  "most-popular-livestream-dj-london-2026",
  "best-society-president-london-2026",
  "most-popular-student-performer-london-2026",
];

export default async function HomePage() {
  // London-only for the MVP: present the London rankings directly.
  // No region picker, no per-account location sections, and empty
  // sections are never rendered — not even their titles.
  const londonRankings = await listRankingsBySlugs(HOMEPAGE_FEATURED_SLUGS);
  const globalTrending = await listTrendingRankings(4);
  const newest = await listNewestRankings(4);

  if (
    globalTrending.length === 0 &&
    newest.length === 0 &&
    londonRankings.length === 0
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
      {londonRankings.length > 0 && (
        <Section title="London Rankings">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {londonRankings.map((r) => (
              <RankingCard key={r.id} ranking={r} />
            ))}
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
