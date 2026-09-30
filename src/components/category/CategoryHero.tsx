import Link from "next/link";
import FollowButton from "@/components/FollowButton";
import { formatCompact } from "@/db/categoryPage";
import type { Category } from "@/lib/types";

// Per-category hero illustrations (premium cover-art style). Categories
// without an entry render a clean brand gradient panel instead — never a
// broken image.
const HERO_IMAGE: Record<string, string> = {
  gaming: "/images/category/gaming-hero.webp",
  cosplay: "/images/category/cosplay-hero.webp",
};

export interface CategoryHeroStats {
  rankingCount: number;
  totalVotes: number;
  totalNominees: number;
  location: string;
}

// Compact category hero: breadcrumb + title + follow + description +
// location + stats on the left, one premium illustration on the right
// with a soft white gradient transition. Max ~240px tall on desktop so
// real ranking content is visible in the first viewport.
export default function CategoryHero({
  category,
  stats,
  following,
  loggedIn,
}: {
  category: Category;
  stats: CategoryHeroStats;
  following: boolean;
  loggedIn: boolean;
}) {
  const heroImage = HERO_IMAGE[category.slug];
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-white">
      <div className="grid grid-cols-1 md:grid-cols-2">
        {/* Left: text */}
        <div className="flex flex-col justify-center px-5 py-5 sm:px-7 md:py-6">
          <Link
            href="/rankings"
            className="text-sm font-medium text-ink hover:opacity-80"
          >
            ← All rankings
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              {category.name}
            </h1>
            <FollowButton
              targetType="category"
              targetId={category.id}
              targetName={category.name}
              initialFollowing={following}
              loggedIn={loggedIn}
            />
          </div>
          {category.description ? (
            <p className="mt-2 max-w-md text-sm leading-relaxed text-subtle">
              {category.description}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-subtle">📍 {stats.location}</p>
          <div className="mt-3 flex items-center gap-4 text-sm text-ink">
            <span>
              <strong className="font-semibold">
                {formatCompact(stats.rankingCount)}
              </strong>{" "}
              <span className="text-subtle">Rankings</span>
            </span>
            <span>
              <strong className="font-semibold">
                {formatCompact(stats.totalVotes)}
              </strong>{" "}
              <span className="text-subtle">Votes</span>
            </span>
            <span>
              <strong className="font-semibold">
                {formatCompact(stats.totalNominees)}
              </strong>{" "}
              <span className="text-subtle">Nominees</span>
            </span>
          </div>
        </div>
        {/* Right: illustration */}
        <div className="relative h-44 md:h-auto md:min-h-[220px]">
          {heroImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImage}
                alt={`${category.name} cover illustration`}
                className="absolute inset-0 h-full w-full object-cover object-top"
              />
            </>
          ) : (
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(120deg, #EFEAFF 0%, #E3ECFF 55%, #D9E4FF 100%)",
              }}
            >
              <div className="absolute -bottom-10 -right-6 h-48 w-48 rounded-full bg-brand/20 blur-2xl" />
              <div className="absolute -top-8 right-16 h-32 w-32 rounded-full bg-brand-deep/20 blur-2xl" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
