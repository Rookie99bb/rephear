import type { Category } from "@/lib/types";
import { getCategoryFallbackBanner } from "@/services/ranking-images/categoryFallbacks";
import { formatCompactCount } from "@/lib/rankingDisplay";
import FollowButton from "./FollowButton";

// Category banner for /rankings?category=<slug>.
// 170px desktop, 16px radius. Artwork occupies the right ~40% and softly
// fades into the light background — emotional context, not a hero.
export default function CategoryBanner({
  category,
  followerCount,
  following,
  loggedIn,
}: {
  category: Category;
  followerCount: number;
  following: boolean;
  loggedIn: boolean;
}) {
  return (
    <section className="relative mb-6 overflow-hidden rounded-2xl border border-[#eceaf4] bg-gradient-to-r from-white via-[#faf8ff] to-[#f3effc]">
      <div className="relative z-10 flex h-[170px] flex-col justify-center gap-2 px-6 py-4 sm:max-w-[62%]">
        <h2 className="text-lg font-bold uppercase tracking-wide text-ink">
          {category.name}
        </h2>
        {category.description && (
          <p className="line-clamp-2 max-w-md text-sm leading-snug text-subtle">
            {category.description}
          </p>
        )}
        <div className="mt-1 flex items-center gap-3">
          <FollowButton
            targetType="category"
            targetId={category.id}
            targetName={category.name}
            initialFollowing={following}
            loggedIn={loggedIn}
          />
          <span className="text-xs text-subtle">
            {formatCompactCount(followerCount)}{" "}
            {followerCount === 1 ? "follower" : "followers"}
          </span>
        </div>
      </div>
      {/* Artwork: right 40%, fading left into the background. Decorative. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] sm:block"
        style={{
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 38%)",
          maskImage: "linear-gradient(to right, transparent 0%, black 38%)",
        }}
      >
        <img
          src={getCategoryFallbackBanner(category.slug)}
          alt=""
          loading="eager"
          decoding="async"
          draggable={false}
          className="h-full w-full object-cover"
        />
      </div>
    </section>
  );
}
