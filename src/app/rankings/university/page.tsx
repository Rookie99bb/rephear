import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CategoryPage from "@/components/CategoryPage";
import { findCategoryBySlug } from "@/db/categories";

export const metadata: Metadata = {
  title: "University Rankings",
  description: "University societies and student creators — ranked by students. Discover the best University rankings on RepHear.",
  alternates: { canonical: "/rankings/university" },
};

// Taxonomy v2 (2026-09-30): canonical category landing page. Static route
// takes precedence over /rankings/[id] (a ranking UUID can never equal a
// category slug), so ranking detail URLs are unaffected.
export default async function UniversityRankingsPage({
  searchParams,
}: {
  searchParams: { sub?: string };
}) {
  const category = await findCategoryBySlug("university");
  if (!category) notFound();
  return (
    <CategoryPage
      categorySlug="university"
      activeSubSlug={searchParams.sub?.trim() || undefined}
    />
  );
}
