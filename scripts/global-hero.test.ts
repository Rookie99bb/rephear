// GlobalDiscoveryHero + ranking card metrics regression suite.
//
// Run: DATA_DIR=$(mktemp -d /tmp/rephear-hero-test.XXXXXX) npx tsx scripts/global-hero.test.ts
// (or: npm run test:global-hero — the script sets its own temp DATA_DIR)
//
// Covers:
//   A. resolveHeroCards: active-state resolution (slug / More / none),
//      open-vs-coming-soon from the live category list, href correctness.
//   B. Metric components: HeatMetric and OrganicLikeMetric render nothing
//      at 0 (no "0 heat" / "0 likes" anywhere) and compact numbers above.
//   C. DB: getRankingsBrowseStats + getRankingCardData split heat
//      (seed+organic combined) from organicLikes, pick the top-liked
//      nominee, and return zero rows for empty rankings.
//   D. Source guard: the compact hero never renders an <h1> (only the
//      homepage owns the main heading).
import { readFileSync } from "node:fs";
// tsconfig uses jsx: preserve, so tsx compiles components with the classic
// runtime (React.createElement). Provide React globally for renderToString.
import * as React from "react";
(globalThis as any).React = React;
import { renderToString } from "react-dom/server";
import { ensureMigrated } from "../src/db/schema";
import { db } from "../src/db/client";
import { createRanking } from "../src/db/rankings";
import { createProfile } from "../src/db/profiles";
import { createUser } from "../src/db/users";
import {
  getRankingCardData,
  getRankingsBrowseStats,
} from "../src/db/homepage";
import { resolveHeroCards } from "../src/components/GlobalDiscoveryHero";
import HeatMetric from "../src/components/rankings/HeatMetric";
import OrganicLikeMetric from "../src/components/rankings/OrganicLikeMetric";
import { newId } from "../src/lib/id";

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    console.log(`  ok - ${name}`);
  } else {
    failures++;
    console.error(`  FAIL - ${name}`);
  }
}

async function main() {
  await ensureMigrated();

  // ---- A. resolveHeroCards ------------------------------------------
  console.log("A. resolveHeroCards");
  const cats = [
    { slug: "anime", name: "Anime" },
    { slug: "cosplay", name: "Cosplay" },
  ] as any[];

  const cosplayActive = resolveHeroCards(cats, "cosplay");
  const cosplay = cosplayActive.find((c) => c.slug === "cosplay")!;
  check("cosplay card is active", cosplay.active === true);
  check(
    "other cards not active",
    cosplayActive.filter((c) => c.active).length === 1,
  );
  check(
    "category href correct",
    cosplay.href === "/rankings?category=cosplay",
  );

  const moreActive = resolveHeroCards(cats, null);
  const more = moreActive.find((c) => c.slug === null)!;
  check("activeSlug=null -> More active", more.active === true);
  check("More href is /rankings", more.href === "/rankings");
  check("More always open", more.open === true);

  const noneActive = resolveHeroCards(cats, undefined);
  check(
    "activeSlug=undefined -> none active",
    noneActive.every((c) => !c.active),
  );

  const gaming = resolveHeroCards(cats, "gaming").find(
    (c) => c.slug === "gaming",
  )!;
  check("unknown slug -> card closed", gaming.open === false);
  check("unknown slug -> not active", gaming.active === false);
  const anime = resolveHeroCards(cats, undefined).find(
    (c) => c.slug === "anime",
  )!;
  check("known slug -> card open", anime.open === true);

  // ---- B. metric components ------------------------------------------
  console.log("B. metric components");
  const html = (el: any) =>
    renderToString(el).replace(/<!--.*?-->/g, "");
  check(
    "HeatMetric renders nothing at 0",
    renderToString(HeatMetric({ value: 0 }) as any) === "",
  );
  check(
    "HeatMetric shows compact heat",
    html(HeatMetric({ value: 6300 }) as any).includes("6.3K heat"),
  );
  check(
    "OrganicLikeMetric renders nothing at 0",
    renderToString(OrganicLikeMetric({ value: 0 }) as any) === "",
  );
  check(
    "OrganicLikeMetric shows compact likes",
    html(OrganicLikeMetric({ value: 1500 }) as any).includes("1.5K likes"),
  );

  // ---- C. DB: heat vs organic split ----------------------------------
  console.log("C. heat / organic split");
  const creator = await createUser({
    email: "hero-creator@example.com",
    passwordHash: "x",
    name: "Hero Creator",
  });
  // One real user per like_source so rows don't trip the (ranking,
  // profile, user) uniqueness constraint.
  const seedUser = await createUser({
    email: "hero-seed@example.com",
    passwordHash: "x",
    name: "Hero Seed",
  });
  const organicUser = await createUser({
    email: "hero-organic@example.com",
    passwordHash: "x",
    name: "Hero Organic",
  });
  const ranking = await createRanking({
    title: "Hero Test Ranking",
    country: "United Kingdom",
    city: "London",
    description: "d",
    createdBy: creator.id,
  });
  const empty = await createRanking({
    title: "Hero Empty Ranking",
    country: "United Kingdom",
    city: "London",
    description: "d",
    createdBy: creator.id,
  });
  const p1 = await createProfile({
    rankingId: ranking.id,
    name: "Top Nominee",
    addedBy: creator.id,
  });
  const p2 = await createProfile({
    rankingId: ranking.id,
    name: "Second Nominee",
    addedBy: creator.id,
  });
  const userFor = (source: "seed" | "organic") =>
    source === "seed" ? seedUser.id : organicUser.id;
  const like = (
    profileId: string,
    source: "seed" | "organic",
    count: number,
  ) =>
    db
      .prepare(
        `INSERT INTO likes (id, ranking_id, profile_id, user_id, like_source, count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      )
      // one row per (ranking, profile, user): distinct user per source row
      .run(newId(), ranking.id, profileId, userFor(source), source, count);
  // p1: 100 seed + 50 organic; p2: 30 organic.
  await like(p1.id, "seed", 100);
  await like(p1.id, "organic", 50);
  await like(p2.id, "organic", 30);

  const bulk = await getRankingsBrowseStats([ranking.id, empty.id]);
  const stat = bulk.get(ranking.id)!;
  check("bulk: heat = seed + organic (180)", stat.heat === 180);
  check("bulk: organicLikes = 80", stat.organicLikes === 80);
  check("bulk: nomineeCount = 2", stat.nomineeCount === 2);
  check(
    "bulk: top nominee is the most-liked one",
    stat.topNomineeName === "Top Nominee",
  );
  const emptyStat = bulk.get(empty.id)!;
  check("bulk: empty ranking heat = 0", emptyStat.heat === 0);
  check("bulk: empty ranking organic = 0", emptyStat.organicLikes === 0);
  check("bulk: empty ranking nominees = 0", emptyStat.nomineeCount === 0);

  const card = await getRankingCardData(ranking.id);
  check("card data: totalLikes = 180", card.totalLikes === 180);
  check("card data: organicLikes = 80", card.organicLikes === 80);

  // ---- D. compact hero has no <h1> ------------------------------------
  console.log("D. compact hero heading guard");
  const src = readFileSync(
    new URL("../src/components/GlobalDiscoveryHero.tsx", import.meta.url),
    "utf8",
  );
  const compactBody = src
    .slice(
      src.indexOf("function CompactHero"),
      src.indexOf("export default function GlobalDiscoveryHero"),
    )
    // strip comments: the rule is about rendered markup, not prose
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  check("CompactHero renders no <h1", !compactBody.includes("<h1"));
  check(
    "CompactHero headline uses <p>",
    compactBody.includes('<p className="text-[26px]'),
  );

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll global-hero checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
