import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CategoryPage from "@/components/CategoryPage";
import { findCategoryBySlug } from "@/db/categories";

export const metadata: Metadata = {
  title: "Digital Creators Rankings",
  description: "TikTokers, YouTubers, streamers, VTubers and fan creators — ranked by their audiences. Discover the best Digital Creators rankings on RepHear.",
  alternates: { canonical: "/rankings/digital-creators" },
};

// Taxonomy v2 (2026-09-30): canonical category landing page. Static route
// takes precedence over /rankings/[id] (a ranking UUID can never equal a
// category slug), so ranking detail URLs are unaffected.
export default async function DigitalCreatorsRankingsPage({
  searchParams,
}: {
  searchParams: { sub?: string };
}) {
  const category = await findCategoryBySlug("digital-creators");
  if (!category) notFound();
  return (
    <CategoryPage
      categorySlug="digital-creators"
      activeSubSlug={searchParams.sub?.trim() || undefined}
    />
  );
}
