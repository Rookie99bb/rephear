import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CategoryPage from "@/components/CategoryPage";
import { findCategoryBySlug } from "@/db/categories";

export const metadata: Metadata = {
  title: "Manga Rankings",
  description: "Manga series, art, characters and genres — ranked by readers. Discover the best Manga rankings on RepHear.",
  alternates: { canonical: "/rankings/manga" },
};

// Taxonomy v2 (2026-09-30): canonical category landing page. Static route
// takes precedence over /rankings/[id] (a ranking UUID can never equal a
// category slug), so ranking detail URLs are unaffected.
export default async function MangaRankingsPage({
  searchParams,
}: {
  searchParams: { sub?: string };
}) {
  const category = await findCategoryBySlug("manga");
  if (!category) notFound();
  return (
    <CategoryPage
      categorySlug="manga"
      activeSubSlug={searchParams.sub?.trim() || undefined}
    />
  );
}
