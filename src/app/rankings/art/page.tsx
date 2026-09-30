import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CategoryPage from "@/components/CategoryPage";
import { findCategoryBySlug } from "@/db/categories";

export const metadata: Metadata = {
  title: "Art Rankings",
  description: "Illustration, zines and visual artists — ranked by fans. Discover the best Art rankings on RepHear.",
  alternates: { canonical: "/rankings/art" },
};

// Taxonomy v2 (2026-09-30): canonical category landing page. Static route
// takes precedence over /rankings/[id] (a ranking UUID can never equal a
// category slug), so ranking detail URLs are unaffected.
export default async function ArtRankingsPage({
  searchParams,
}: {
  searchParams: { sub?: string };
}) {
  const category = await findCategoryBySlug("art");
  if (!category) notFound();
  return (
    <CategoryPage
      categorySlug="art"
      activeSubSlug={searchParams.sub?.trim() || undefined}
    />
  );
}
