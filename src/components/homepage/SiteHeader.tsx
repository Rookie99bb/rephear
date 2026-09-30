"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import HeaderAuth from "@/components/HeaderAuth";
import SearchBox from "./SearchBox";

// Site header restyle for the homepage redesign: logo left, nav with a
// lavender active pill, large search field, Log in + dark Sign up
// on the right. Nav links are the EXISTING routes only — Communities,
// Events and Creators have no routes/data, so they are not linked here.
// The active pill follows the current pathname (this header is site-wide).
export default function SiteHeader({
  userName,
  isAdmin,
  isLoggedIn,
}: {
  userName: string | null;
  isAdmin: boolean;
  isLoggedIn: boolean;
}) {
  const pathname = usePathname() ?? "/";
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/rankings")
      // Rankings stays active on detail pages, but never steals the
      // highlight from "New Ranking".
      return pathname === "/rankings" || /^\/rankings\/[^/]+$/.test(pathname);
    return pathname === href;
  };
  const activeCls =
    "rounded-full bg-brand-soft px-3.5 py-1.5 font-semibold text-brand-ink";
  const navLink =
    "rounded-full px-3.5 py-1.5 text-sm font-medium text-subtle transition hover:bg-black/5 hover:text-ink";
  return (
    <header className="border-b border-border bg-white">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="RepHear — Recognition belongs to everyone.">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-xl font-extrabold text-white"
            style={{ background: "linear-gradient(135deg, #7B4DFF, #4285F4)" }}
          >
            R
          </span>
          <span className="leading-none">
            <span className="block text-[21px] font-extrabold tracking-tight text-ink">
              RepHear
            </span>
            <span className="mt-0.5 block text-[10px] font-medium text-subtle">
              Recognition belongs to everyone.
            </span>
          </span>
        </Link>

        <nav
          aria-label="Primary"
          className="flex flex-wrap items-center gap-1 text-sm"
        >
          <Link
            href="/"
            aria-current={isActive("/") ? "page" : undefined}
            className={isActive("/") ? activeCls : navLink}
          >
            Home
          </Link>
          <Link
            href="/rankings"
            aria-current={isActive("/rankings") ? "page" : undefined}
            className={isActive("/rankings") ? activeCls : navLink}
          >
            Rankings
          </Link>
          {isLoggedIn && (
            <Link
              href="/rankings/new"
              aria-current={isActive("/rankings/new") ? "page" : undefined}
              className={isActive("/rankings/new") ? activeCls : navLink}
            >
              New Ranking
            </Link>
          )}
          {isLoggedIn && (
            <Link
              href="/credits"
              aria-current={isActive("/credits") ? "page" : undefined}
              className={isActive("/credits") ? activeCls : navLink}
            >
              Credits
            </Link>
          )}
          {isLoggedIn && (
            <Link
              href="/settings"
              aria-current={isActive("/settings") ? "page" : undefined}
              className={isActive("/settings") ? activeCls : navLink}
            >
              Settings
            </Link>
          )}
          {isAdmin && (
            <Link
              href="/admin/claims"
              aria-current={isActive("/admin") ? "page" : undefined}
              className={isActive("/admin") ? activeCls : navLink}
            >
              Admin
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <div className="hidden md:block">
            <SearchBox />
          </div>
          <HeaderAuth userName={userName} />
        </div>

        <div className="basis-full md:hidden">
          <SearchBox />
        </div>
      </div>
    </header>
  );
}
