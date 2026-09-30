import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CategoryPage from "@/components/CategoryPage";
import { findCategoryBySlug } from "@/db/categories";

export const metadata: Metadata = {
  title: "Gaming Rankings",
  description: "Games, characters, esports and gaming communities — ranked by players. Discover the best Gaming rankings on RepHear.",
  alternates: { canonical: "/rankings/gaming" },
};

// Taxonomy v2 (2026-09-30): canonical category landing page. Static route
// takes precedence over /rankings/[id] (a ranking UUID can never equal a
// category slug), so ranking detail URLs are unaffected.
export default async function GamingRankingsPage({
  searchParams,
}: {
  searchParams: { sub?: string };
}) {
  const category = await findCategoryBySlug("gaming");
  if (!category) notFound();
  return (
    <CategoryPage
      categorySlug="gaming"
      activeSubSlug={searchParams.sub?.trim() || undefined}
    />
  );
}
