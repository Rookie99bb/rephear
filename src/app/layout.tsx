import "@/db/schema";
import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import SessionProvider from "@/components/SessionProvider";
import HeaderAuth from "@/components/HeaderAuth";
import LocationGate from "@/components/LocationGate";
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
      <body className="font-sans">
        <SessionProvider>
          <header className="border-b border-border">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
              <Link
                href="/"
                className="text-[15px] font-semibold tracking-tight text-ink"
              >
                RepHear
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
          <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
            {needsLocation ? <LocationGate /> : children}
          </main>
        </SessionProvider>
      </body>
    </html>
  );
}
