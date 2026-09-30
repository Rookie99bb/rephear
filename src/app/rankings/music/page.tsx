import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CategoryPage from "@/components/CategoryPage";
import { findCategoryBySlug } from "@/db/categories";

export const metadata: Metadata = {
  title: "Music Rankings",
  description: "DJs, rap, grime, K-pop, producers and radio — ranked by listeners. Discover the best Music rankings on RepHear.",
  alternates: { canonical: "/rankings/music" },
};

// Taxonomy v2 (2026-09-30): canonical category landing page. Static route
// takes precedence over /rankings/[id] (a ranking UUID can never equal a
// category slug), so ranking detail URLs are unaffected.
export default async function MusicRankingsPage({
  searchParams,
}: {
  searchParams: { sub?: string };
}) {
  const category = await findCategoryBySlug("music");
  if (!category) notFound();
  return (
    <CategoryPage
      categorySlug="music"
      activeSubSlug={searchParams.sub?.trim() || undefined}
    />
  );
}
