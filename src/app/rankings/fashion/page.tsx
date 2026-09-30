import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CategoryPage from "@/components/CategoryPage";
import { findCategoryBySlug } from "@/db/categories";

export const metadata: Metadata = {
  title: "Fashion Rankings",
  description: "Streetwear, beauty and fashion creators — ranked by the community. Discover the best Fashion rankings on RepHear.",
  alternates: { canonical: "/rankings/fashion" },
};

// Taxonomy v2 (2026-09-30): canonical category landing page. Static route
// takes precedence over /rankings/[id] (a ranking UUID can never equal a
// category slug), so ranking detail URLs are unaffected.
export default async function FashionRankingsPage({
  searchParams,
}: {
  searchParams: { sub?: string };
}) {
  const category = await findCategoryBySlug("fashion");
  if (!category) notFound();
  return (
    <CategoryPage
      categorySlug="fashion"
      activeSubSlug={searchParams.sub?.trim() || undefined}
    />
  );
}
