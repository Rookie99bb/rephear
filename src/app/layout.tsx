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

export const metadata: Metadata = {
  title: "RepHear",
  description:
    "An open public ranking platform where communities recognize and support people together.",
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
                  className="hidden h-14 w-auto sm:block"
                />
                {/* Compact icon-only mark for narrow screens, so the header
                    never squeezes or distorts the full lockup. */}
                <Image
                  src="/logo.png"
                  alt="RepHear"
                  width={28}
                  height={25}
                  priority
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
