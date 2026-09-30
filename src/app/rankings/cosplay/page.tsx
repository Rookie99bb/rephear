import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CategoryPage from "@/components/CategoryPage";
import { findCategoryBySlug } from "@/db/categories";

export const metadata: Metadata = {
  title: "Cosplay Rankings",
  description: "Cosplayers, costumes, craft and convention culture — ranked by fans. Discover the best Cosplay rankings on RepHear.",
  alternates: { canonical: "/rankings/cosplay" },
};

// Taxonomy v2 (2026-09-30): canonical category landing page. Static route
// takes precedence over /rankings/[id] (a ranking UUID can never equal a
// category slug), so ranking detail URLs are unaffected.
export default async function CosplayRankingsPage({
  searchParams,
}: {
  searchParams: { sub?: string };
}) {
  const category = await findCategoryBySlug("cosplay");
  if (!category) notFound();
  return (
    <CategoryPage
      categorySlug="cosplay"
      activeSubSlug={searchParams.sub?.trim() || undefined}
    />
  );
}
