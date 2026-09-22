import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/siteUrl";
import { listAllRankings } from "@/db/rankings";
import { listPublicProfileIdsForSitemap } from "@/db/profiles";

// Previously missing entirely (fell through to the 404 shell — see the
// optimization review), which meant search engines had no path to
// individual Ranking/Profile pages beyond crawling links one at a time.
// Regenerated per-request (App Router calls this like any other route);
// the site is small enough that this costs two lightweight queries, not
// a real performance concern at MVP scale.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${siteUrl}/rankings`, changeFrequency: "hourly", priority: 0.9 },
  ];

  const [rankings, profiles] = await Promise.all([
    listAllRankings(),
    listPublicProfileIdsForSitemap(),
  ]);

  const rankingRoutes: MetadataRoute.Sitemap = rankings.map((r) => ({
    url: `${siteUrl}/rankings/${r.id}`,
    lastModified: r.createdAt,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const profileRoutes: MetadataRoute.Sitemap = profiles.map((p) => ({
    url: `${siteUrl}/profiles/${p.id}`,
    lastModified: p.updatedAt,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  return [...staticRoutes, ...rankingRoutes, ...profileRoutes];
}
