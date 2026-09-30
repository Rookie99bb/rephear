import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CategoryPage from "@/components/CategoryPage";
import { findCategoryBySlug } from "@/db/categories";

export const metadata: Metadata = {
  title: "Events & Nightlife Rankings",
  description: "Club nights, venues, promoters and festivals — ranked by the night. Discover the best Events & Nightlife rankings on RepHear.",
  alternates: { canonical: "/rankings/events-nightlife" },
};

// Taxonomy v2 (2026-09-30): canonical category landing page. Static route
// takes precedence over /rankings/[id] (a ranking UUID can never equal a
// category slug), so ranking detail URLs are unaffected.
export default async function EventsNightlifeRankingsPage({
  searchParams,
}: {
  searchParams: { sub?: string };
}) {
  const category = await findCategoryBySlug("events-nightlife");
  if (!category) notFound();
  return (
    <CategoryPage
      categorySlug="events-nightlife"
      activeSubSlug={searchParams.sub?.trim() || undefined}
    />
  );
}
