import Link from "next/link";
import type { Category } from "@/lib/types";

// A category section card for the curated homepage lineup. Same visual
// as RankingCard; links to the category-filtered browse view.
export default function CategoryCard({ category }: { category: Category }) {
  return (
    <Link
      href={`/rankings?category=${category.slug}`}
      className="block rounded-xl border border-border p-5 transition hover:border-ink"
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-subtle">
        London, United Kingdom
      </p>
      <h3 className="mt-1 text-base font-semibold tracking-tight text-ink">
        {category.name}
      </h3>
      {category.description && (
        <p className="mt-1.5 line-clamp-2 text-sm text-subtle">
          {category.description}
        </p>
      )}
    </Link>
  );
}
