import "@/db/schema";
import "./globals.css";
import type { Metadata } from "next";
import SessionProvider from "@/components/SessionProvider";
import { SupportCelebrationProvider } from "@/components/SupportCelebrationProvider";
import SiteHeader from "@/components/homepage/SiteHeader";
import LocationGate from "@/components/LocationGate";
import Footer from "@/components/Footer";
import { getCurrentFullUser } from "@/lib/session";
import { isAdminEmail } from "@/lib/admin";
import { getSiteUrl } from "@/lib/siteUrl";

const siteName = "RepHear";
const siteDescription =
  "RepHear is a public reputation platform where every voice helps recognize, appreciate, and support people. Together, we build public reputation. Every voice deserves to be heard.";

// metadataBase + default Open Graph/Twitter tags. Every page previously
// inherited the bare "RepHear" title with no OG/Twitter tags at all, so
// shared links unfurled with no image and no page-specific text (see the
// optimization review) — this is the site-wide fallback; individual
// Ranking/Profile pages override title/description/url via their own
// generateMetadata(). logo-full.png is a placeholder OG image (it's the
// existing wordmark, not a purpose-built 1200x630 social card) — a
// proper per-page generated OG image is a good follow-up, not done here.
export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: siteName,
    template: `%s — ${siteName}`,
  },
  description: siteDescription,
  openGraph: {
    type: "website",
    siteName,
    title: siteName,
    description: siteDescription,
    images: [{ url: "/logo-full.png", width: 1013, height: 276, alt: siteName }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
    images: ["/logo-full.png"],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentFullUser();
  const isAdmin = isAdminEmail(user?.email);
  const needsLocation = !!user && !user.location;

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col font-sans">
        <SessionProvider>
        <SupportCelebrationProvider>
          <SiteHeader
            userName={user?.name ?? null}
            isAdmin={isAdmin}
            isLoggedIn={!!user}
          />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
            {needsLocation ? <LocationGate /> : children}
          </main>
          <Footer />
        </SupportCelebrationProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
