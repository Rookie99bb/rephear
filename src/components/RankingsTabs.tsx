"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Rankings discovery navigation (Taxonomy v2): For You / Anime / Gaming /
// Manga / Cosplay / Creators / Music / More. "More" holds the remaining
// primary categories so the bar stays minimal instead of becoming a
// database directory.
const PRIMARY_TABS = [
  { label: "For You", href: "/rankings" },
  { label: "Anime", href: "/rankings/anime" },
  { label: "Gaming", href: "/rankings/gaming" },
  { label: "Manga", href: "/rankings/manga" },
  { label: "Cosplay", href: "/rankings/cosplay" },
  { label: "Creators", href: "/rankings/digital-creators" },
  { label: "Music", href: "/rankings/music" },
];

const MORE_TABS = [
  { label: "Fashion", href: "/rankings/fashion" },
  { label: "Art", href: "/rankings/art" },
  { label: "University", href: "/rankings/university" },
  { label: "Food", href: "/rankings/food" },
  { label: "Sports", href: "/rankings/sports" },
  { label: "Entertainment", href: "/rankings/entertainment" },
  { label: "Events & Nightlife", href: "/rankings/events-nightlife" },
];

export default function RankingsTabs() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_TABS.some((t) => t.href === pathname);

  const tabClass = (active: boolean) =>
    `shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
      active
        ? "bg-ink text-white"
        : "text-subtle hover:bg-[#f4f2fa] hover:text-ink"
    }`;

  return (
    <nav
      aria-label="Rankings categories"
      className="mb-6 flex items-center gap-1 overflow-x-auto border-b border-border pb-3"
    >
      {PRIMARY_TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={pathname === t.href ? "page" : undefined}
          className={tabClass(pathname === t.href)}
        >
          {t.label}
        </Link>
      ))}
      <div
        className="relative shrink-0"
        onMouseEnter={() => setMoreOpen(true)}
        onMouseLeave={() => setMoreOpen(false)}
      >
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          aria-haspopup="true"
          className={tabClass(moreActive)}
        >
          More {moreOpen ? "▴" : "▾"}
        </button>
        {moreOpen && (
          <div className="absolute left-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-xl border border-border bg-white py-1 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
            {MORE_TABS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                onClick={() => setMoreOpen(false)}
                className={`block px-4 py-2 text-sm transition hover:bg-[#f4f2fa] ${
                  pathname === t.href
                    ? "font-semibold text-ink"
                    : "text-subtle hover:text-ink"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
