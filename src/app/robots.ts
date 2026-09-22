import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/siteUrl";

// Real robots.txt so search engines can actually find /sitemap.xml and
// index public Rankings/Profiles — previously this route fell through to
// the 404 shell (see the optimization review). /admin and account/API
// routes are kept out of the crawl; everything else public stays open.
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/login",
        "/signup",
        "/forgot-password",
        "/settings",
        "/credits",
        "/invite/",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
