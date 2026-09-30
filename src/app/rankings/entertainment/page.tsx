import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CategoryPage from "@/components/CategoryPage";
import { findCategoryBySlug } from "@/db/categories";

export const metadata: Metadata = {
  title: "Entertainment Rankings",
  description: "Comedy, film, TV and entertainment personalities — ranked by audiences. Discover the best Entertainment rankings on RepHear.",
  alternates: { canonical: "/rankings/entertainment" },
};

// Taxonomy v2 (2026-09-30): canonical category landing page. Static route
// takes precedence over /rankings/[id] (a ranking UUID can never equal a
// category slug), so ranking detail URLs are unaffected.
export default async function EntertainmentRankingsPage({
  searchParams,
}: {
  searchParams: { sub?: string };
}) {
  const category = await findCategoryBySlug("entertainment");
  if (!category) notFound();
  return (
    <CategoryPage
      categorySlug="entertainment"
      activeSubSlug={searchParams.sub?.trim() || undefined}
    />
  );
}
