// Homepage category entry cards regression suite.
//
// Run: DATA_DIR=$(mktemp -d) npx tsx scripts/homepage-category-cards.test.ts
// (or: npm run test:homepage-cards — the script sets its own temp DATA_DIR)
//
// Covers:
//   A. Config integrity: the 10 cards come from ONE config module, every
//      slug is a real taxonomy slug (never guessed), hrefs are well-formed,
//      and no legacy/wrong slugs (underground-music, independent-art-zines,
//      university-societies) appear anywhere.
//   B. Rendering: open cards render as real <a> links (mouse-clickable,
//      keyboard-focusable, Enter-activatable); cards whose category does
//      not exist yet render an explicit "Coming soon" disabled state and
//      never look clickable.
//   C. Slug -> page-title consistency: the slug in each href resolves via
//      findCategoryBySlug() (exactly what /rankings?category=<slug> does)
//      and the resolved category name is what the page renders as its
//      section title. Music: label == slug == page title.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ensureMigrated } from "../src/db/schema";
import { findOrCreateCategory, findCategoryBySlug } from "../src/db/categories";
import { TAXONOMY } from "../src/db/taxonomy";
import {
  HOMEPAGE_CATEGORY_CARDS,
  homepageCategoryHref,
} from "../src/config/homepageCategories";
import HeroDiscovery from "../src/components/homepage/HeroDiscovery";
import type { Category } from "../src/lib/types";

// HeroDiscovery.tsx relies on the automatic JSX runtime (no React import).
// Provide the classic global so renderToStaticMarkup works under tsx.
(globalThis as unknown as { React: typeof React }).React = React;

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

const EXPECTED: { label: string; icon: string; slug: string | null; href: string }[] = [
  { label: "Anime", icon: "🎭", slug: "anime", href: "/rankings?category=anime" },
  { label: "Cosplay", icon: "🦸", slug: "cosplay", href: "/rankings?category=cosplay" },
  { label: "Gaming", icon: "🎮", slug: "gaming", href: "/rankings?category=gaming" },
  { label: "University", icon: "🎓", slug: "university", href: "/rankings?category=university" },
  { label: "Music", icon: "🎵", slug: "music", href: "/rankings?category=music" },
  { label: "Artists", icon: "🎨", slug: "art", href: "/rankings?category=art" },
  { label: "Creators", icon: "📸", slug: "digital-creators", href: "/rankings?category=digital-creators" },
  { label: "Manga", icon: "📚", slug: "manga", href: "/rankings?category=manga" },
  { label: "Events", icon: "🗓️", slug: "events-nightlife", href: "/rankings?category=events-nightlife" },
  { label: "More", icon: "⋯", slug: null, href: "/rankings" },
];

function categoryList(slugs: readonly string[]): Category[] {
  const bySlug = new Map(TAXONOMY.map((c) => [c.slug, c]));
  return slugs.map((slug) => {
    const t = bySlug.get(slug)!;
    return {
      id: `test-${slug}`,
      name: t.name,
      slug: t.slug,
      description: t.description ?? "",
      createdAt: "",
    };
  });
}
const ALL_SLUGS = EXPECTED.map((e) => e.slug).filter(
  (s): s is string => s !== null,
);

async function main() {
  if (!process.env.DATA_DIR) {
    throw new Error("DATA_DIR must be set (use npm run test:homepage-cards)");
  }
  await ensureMigrated();

  console.log("A. Config integrity");
  check("exactly 10 cards", HOMEPAGE_CATEGORY_CARDS.length === 10);
  check(
    "labels in the required order",
    HOMEPAGE_CATEGORY_CARDS.map((c) => c.label).join("|") ===
      EXPECTED.map((e) => e.label).join("|"),
  );
  const taxonomySlugs = new Set(TAXONOMY.map((c) => c.slug));
  for (const card of HOMEPAGE_CATEGORY_CARDS) {
    if (card.slug) {
      check(
        `slug "${card.slug}" is a real taxonomy slug`,
        taxonomySlugs.has(card.slug),
      );
    }
  }
  for (const e of EXPECTED) {
    const card = HOMEPAGE_CATEGORY_CARDS.find((c) => c.label === e.label)!;
    check(
      `${e.label}: href is ${e.href}`,
      homepageCategoryHref(card) === e.href,
      `got ${homepageCategoryHref(card)}`,
    );
  }
  const configSource = JSON.stringify(HOMEPAGE_CATEGORY_CARDS);
  for (const legacy of [
    "underground-music",
    "independent-art-zines",
    "university-societies",
  ]) {
    check(`no legacy slug "${legacy}" in config`, !configSource.includes(legacy));
  }

  console.log("B1. Rendering — all categories present: every card is a link");
  const fullHtml = renderToStaticMarkup(
    React.createElement(HeroDiscovery, { categories: categoryList(ALL_SLUGS) }),
  );
  for (const e of EXPECTED) {
    // Each card renders twice (mobile row + desktop row).
    check(
      `${e.label}: <a href="${e.href}"> rendered`,
      count(fullHtml, `href="${e.href}"`) === 2,
      `found ${count(fullHtml, `href="${e.href}"`)}`,
    );
    check(
      `${e.label}: label+icon inside the link`,
      count(fullHtml, `>${e.icon}</span>${e.label}<`) === 2,
    );
  }
  for (const legacy of [
    "underground-music",
    "independent-art-zines",
    "university-societies",
  ]) {
    check(`no "${legacy}" in rendered HTML`, !fullHtml.includes(legacy));
  }
  check("no Coming soon when everything is open", !fullHtml.includes("Coming soon"));

  console.log("B2. Rendering — missing categories show Coming soon, never fake links");
  const missing = ["art", "events-nightlife", "university", "manga"];
  const partialHtml = renderToStaticMarkup(
    React.createElement(HeroDiscovery, {
      categories: categoryList(ALL_SLUGS.filter((s) => !missing.includes(s))),
    }),
  );
  for (const slug of missing) {
    const label = EXPECTED.find((e) => e.slug === slug)!.label;
    check(
      `${label}: no link rendered`,
      !partialHtml.includes(`category=${slug}`),
    );
    check(
      `${label}: explicit Coming soon state`,
      count(partialHtml, "Coming soon") >= 2,
    );
  }
  check(
    "disabled cards use aria-disabled spans (not focusable)",
    count(partialHtml, 'aria-disabled="true"') === missing.length * 2,
    `found ${count(partialHtml, 'aria-disabled="true"')}`,
  );
  check(
    "disabled cards carry no tabindex (not keyboard-focusable)",
    !partialHtml.includes("tabindex"),
  );
  for (const e of EXPECTED.filter((x) => x.slug && !missing.includes(x.slug))) {
    check(
      `${e.label}: still a real link`,
      count(partialHtml, `href="${e.href}"`) === 2,
    );
  }

  console.log("C. Slug -> category -> page title consistency (fresh DB)");
  for (const t of TAXONOMY) {
    await findOrCreateCategory({ name: t.name, slug: t.slug });
  }
  for (const e of EXPECTED) {
    if (!e.slug) continue;
    // Parse the slug exactly like the card href carries it.
    const parsed = new URL(e.href, "http://localhost").searchParams.get("category");
    check(`${e.label}: href carries slug "${e.slug}"`, parsed === e.slug);
    // /rankings?category=<slug> resolves via findCategoryBySlug and renders
    // activeCategory.name as the section title.
    const cat = await findCategoryBySlug(e.slug);
    check(`${e.label}: slug resolves to a real category`, cat !== null);
    if (cat) {
      console.log(`       page title for ${e.label}: "${cat.name}"`);
    }
  }
  const music = (await findCategoryBySlug("music"))!;
  check('Music: label == page title ("Music")', music.name === "Music");
  const artists = (await findCategoryBySlug("art"))!;
  check('Artists: lands on the real Art category (not Independent Art & Zines)', artists.name === "Art");
  const events = (await findCategoryBySlug("events-nightlife"))!;
  check('Events: lands on "Events & Nightlife"', events.name === "Events & Nightlife");

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(1);
});
