import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CategoryPage from "@/components/CategoryPage";
import { findCategoryBySlug } from "@/db/categories";

export const metadata: Metadata = {
  title: "Food Rankings",
  description: "Food creators and spots — ranked by food lovers. Discover the best Food rankings on RepHear.",
  alternates: { canonical: "/rankings/food" },
};

// Taxonomy v2 (2026-09-30): canonical category landing page. Static route
// takes precedence over /rankings/[id] (a ranking UUID can never equal a
// category slug), so ranking detail URLs are unaffected.
export default async function FoodRankingsPage({
  searchParams,
}: {
  searchParams: { sub?: string };
}) {
  const category = await findCategoryBySlug("food");
  if (!category) notFound();
  return (
    <CategoryPage
      categorySlug="food"
      activeSubSlug={searchParams.sub?.trim() || undefined}
    />
  );
}
