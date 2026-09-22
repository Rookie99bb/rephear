import "@/db/schema";
import "./globals.css";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SessionProvider from "@/components/SessionProvider";
import { SupportCelebrationProvider } from "@/components/SupportCelebrationProvider";
import HeaderAuth from "@/components/HeaderAuth";
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
          <header className="border-b border-border">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
              <Link href="/" className="flex shrink-0 items-center" aria-label="RepHear — Recognition belongs to everyone.">
                {/* Full brand lockup (icon + wordmark + tagline) as a single
                    official asset — shown from the sm breakpoint up, where
                    there's room for it. */}
                <Image
                  src="/logo-full.png"
                  alt="RepHear — Recognition belongs to everyone."
                  width={1013}
                  height={276}
                  priority
                  sizes="(min-width: 640px) 205px, 0px"
                  className="hidden h-14 w-auto sm:block"
                />
                {/* Compact icon-only mark for narrow screens, so the header
                    never squeezes or distorts the full lockup. Only ONE of
                    these two logo variants is ever visible at a time (CSS
                    hidden/sm:hidden), but next/image's `priority` preloads
                    regardless of visibility — without `sizes`, both were
                    being preloaded at up to full native resolution
                    (1013x276 / 512x462), doubling the LCP payload for
                    nothing. The `sizes` hints below let the browser fetch
                    only the small responsive variant actually rendered on
                    each breakpoint (see the optimization review). */}
                <Image
                  src="/logo.png"
                  alt="RepHear"
                  width={28}
                  height={25}
                  priority
                  sizes="(max-width: 639px) 32px, 0px"
                  className="h-8 w-auto sm:hidden"
                />
              </Link>
              <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-subtle sm:gap-x-6">
                <Link href="/rankings" className="hover:text-ink">
                  Rankings
                </Link>
                {user && (
                  <Link href="/rankings/new" className="hover:text-ink">
                    New Ranking
                  </Link>
                )}
                {user && (
                  <Link href="/credits" className="hover:text-ink">
                    Credits
                  </Link>
                )}
                {user && (
                  <Link href="/settings" className="hover:text-ink">
                    Settings
                  </Link>
                )}
                {isAdmin && (
                  <Link href="/admin/claims" className="hover:text-ink">
                    Admin
                  </Link>
                )}
                <HeaderAuth userName={user?.name ?? null} />
              </nav>
            </div>
          </header>
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
