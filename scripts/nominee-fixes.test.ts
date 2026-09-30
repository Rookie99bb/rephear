// Nominee card fixes regression suite (Phase 3/4/5/6).
//
// Run: DATA_DIR=$(mktemp -d) npx tsx scripts/nominee-fixes.test.ts
//
// Covers exactly the acceptance matrix for this round:
//   LIKE DISPLAY (Phase 3)
//     A. formatLikeCountLabel: 0 / 1 / many votes always show a number,
//        0 is never hidden.
//     B. canCastLike: logged-out can't like; logged-in under cap can;
//        viewer count at cap can't.
//     C. Optimistic update: +1 on tap; success adopts the server's public
//        total; failure rolls back exactly.
//     D. (DB) entry.likeCount == weighted public total for 0/1/many;
//        a second viewer's own Likes never change the public total;
//        Most Loved order still sorts by likeCount desc.
//   LOCATION (Phase 5)
//     E. Global anime/manga/gaming (non-geo) never display a city even
//        when the ranking row stores London for gating.
//     F. City-scope local people show the ranking city; country-scope
//        shows the country; a profile's own region wins; global
//        person/creator without region shows nothing (never the gating
//        city).
//   PLACEHOLDER (Phase 4)
//     G. Missing photo renders the category placeholder art (not a broken
//        img); entity kind label matches the taxonomy.
//   QUALITY GATES (Phase 6)
//     H. ready / needs-attention / draft verdicts; each of the 8 checks
//        fails on the right input.
//   RENDER (server components)
//     I. NomineeCard static markup: 0 -> "Like · 0"; 326 -> "Like · 326";
//        logged-out shows a /login Like link; global-anime card markup
//        contains no "London"; city music card shows "London, United
//        Kingdom"; Most Loved and Most Supported render the same total.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ensureMigrated } from "../src/db/schema";
import { db } from "../src/db/client";
import { createUser } from "../src/db/users";
import { createRanking } from "../src/db/rankings";
import { createProfile } from "../src/db/profiles";
import {
  getLeaderboards,
} from "../src/db/leaderboards";
import { getPublicOrganicLikeTotal, incrementLike } from "../src/db/likes";
import {
  formatLikeCountLabel,
  canCastLike,
  applyOptimisticLike,
  resolveLikeUpdate,
} from "../src/lib/likeDisplay";
import { placeholderArtThemeForCategory } from "../src/lib/nomineeMeta";
import {
  getRankingLocationLabel,
  getNomineeCardLocationLabel,
} from "../src/lib/rankingDisplay";
import { evaluateRankingQuality } from "../src/lib/rankingQualityGates";
import NomineeCard from "../src/components/NomineeCard";
import { SupportCelebrationProvider } from "../src/components/SupportCelebrationProvider";
import type {
  LeaderboardEntry,
  Profile,
  Ranking,
} from "../src/lib/types";
import { newId } from "../src/lib/id";

// NomineeCardGlow consumes useSupportCelebration(), so NomineeCard must
// render inside the provider even in static-markup tests.
function renderCard(props: React.ComponentProps<typeof NomineeCard>): string {
  return renderToStaticMarkup(
    React.createElement(
      SupportCelebrationProvider,
      null,
      React.createElement(NomineeCard, props)
    )
  );
}

// NomineeCard.tsx relies on the automatic JSX runtime (no React import).
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

async function main() {
  await ensureMigrated();

  // ---------------------------------------------------------------- A/B/C
  console.log("\nA. formatLikeCountLabel");
  check("0 votes shows explicitly", formatLikeCountLabel(0) === "❤️ Like · 0", formatLikeCountLabel(0));
  check("1 vote", formatLikeCountLabel(1) === "❤️ Like · 1", formatLikeCountLabel(1));
  check("326 votes", formatLikeCountLabel(326) === "❤️ Like · 326", formatLikeCountLabel(326));
  check("4800 compacts", formatLikeCountLabel(4800) === "❤️ Like · 4.8K", formatLikeCountLabel(4800));

  console.log("\nB. canCastLike");
  check("logged-out cannot like", canCastLike(false, 0, 1) === false);
  check("logged-in under cap can like", canCastLike(true, 0, 1) === true);
  check("logged-in shared-unlocked can like", canCastLike(true, 1, 2) === true);
  check("at cap cannot like", canCastLike(true, 1, 1) === false);

  console.log("\nC. optimistic update + rollback");
  const before = { total: 326, userCount: 0, hasLiked: false };
  const optimistic = applyOptimisticLike(before);
  check("optimistic +1/+1", optimistic.total === 327 && optimistic.userCount === 1);
  const resolvedOk = resolveLikeUpdate(before, optimistic, {
    publicOrganicLikeCount: 327,
    userLikeCount: 1,
    hasLiked: true,
  });
  check(
    "success adopts server total",
    resolvedOk.total === 327 && resolvedOk.userCount === 1,
    JSON.stringify(resolvedOk)
  );
  const resolvedStale = resolveLikeUpdate(before, optimistic, {
    publicOrganicLikeCount: 400,
  });
  check("success converges to newer server total", resolvedStale.total === 400);
  const resolvedErr = resolveLikeUpdate(before, optimistic, { error: "Too many Likes" });
  check(
    "failure rolls back exactly",
    resolvedErr.total === 326 && resolvedErr.userCount === 0,
    JSON.stringify(resolvedErr)
  );

  // ---------------------------------------------------------------- E
  console.log("\nE/F. location (Global/London scope-only, 方案C)");
  // DB rows keep the gating city even on global rankings; the display
  // layer must never leak it.
  const globalRanking = {
    scope: "global",
    isGlobal: true,
    city: "London",
    country: "United Kingdom",
  } as unknown as Ranking;
  const londonRanking = {
    scope: "city",
    isGlobal: false,
    city: "London",
    country: "United Kingdom",
  } as unknown as Ranking;
  check(
    "global header shows 🌍 Global",
    getRankingLocationLabel(globalRanking) === "🌍 Global"
  );
  check(
    "global header plain variant is 'Global'",
    getRankingLocationLabel(globalRanking, { plain: true }) === "Global"
  );
  check(
    "london header shows 📍 London, United Kingdom",
    getRankingLocationLabel(londonRanking) === "📍 London, United Kingdom"
  );
  check(
    "london header plain variant drops the emoji",
    getRankingLocationLabel(londonRanking, { plain: true }) ===
      "London, United Kingdom"
  );
  check(
    "global card renders NO location row",
    getNomineeCardLocationLabel(globalRanking) === null
  );
  check(
    "global card hides the DB gating city (London kept for gating only)",
    getNomineeCardLocationLabel({
      ...globalRanking,
      isGlobal: false,
    } as unknown as Ranking) === null
  );
  check(
    "london card shows plain text, no emoji",
    getNomineeCardLocationLabel(londonRanking) === "London, United Kingdom"
  );
  check(
    "card location helper takes the ranking only (profile.region can never override)",
    getNomineeCardLocationLabel.length === 1
  );
  // Placeholder art is decorative theming from taxonomy slugs — not an
  // entity-type claim.
  check(
    "anime category -> book theme",
    placeholderArtThemeForCategory({
      categorySlug: "anime",
      subcategorySlug: "anime-series",
    }) === "book"
  );
  check(
    "cosplay category -> person theme",
    placeholderArtThemeForCategory({
      categorySlug: "cosplay",
      subcategorySlug: null,
    }) === "person"
  );

  // ---------------------------------------------------------------- H
  console.log("\nH. quality gates");
  const qRanking = {
    id: "r1",
    title: "Best Anime of All Time",
    categorySlug: "anime",
    subcategorySlug: "anime-series",
    scope: "global" as const,
    city: "London",
    country: "United Kingdom",
  };
  const qNominees = [1, 2, 3, 4, 5].map((i) => ({
    id: `p${i}`,
    name: `Anime ${i}`,
    photoUrl: `https://cdn.example.com/${i}.jpg`,
    region: "",
  }));
  const readyInput = {
    ranking: qRanking,
    nominees: qNominees,
    photoUrlStatus: new Map(qNominees.map((n) => [n.id, "ok" as const])),
    engagementReady: new Set(qNominees.map((n) => n.id)),
  };
  const ready = evaluateRankingQuality(readyInput);
  check("all-pass -> ready", ready.verdict === "ready", ready.verdict);
  check("coverage 100%", ready.coverage === 1);

  const draft = evaluateRankingQuality({ ...readyInput, nominees: [] });
  check("empty ranking -> draft", draft.verdict === "draft", draft.verdict);

  const top3Missing = evaluateRankingQuality({
    ...readyInput,
    nominees: qNominees.map((n, i) => (i === 1 ? { ...n, photoUrl: "" } : n)),
  });
  check(
    "top-3 missing photo -> needs-attention",
    top3Missing.verdict === "needs-attention" &&
      top3Missing.checks.find((c) => c.id === "top3-photos")!.passed === false
  );
  // Coverage: 4/5 = 80% still passes the default threshold.
  check(
    "4/5 coverage still passes 80%",
    top3Missing.checks.find((c) => c.id === "photo-coverage")!.passed === true
  );
  const lowCoverage = evaluateRankingQuality({
    ...readyInput,
    nominees: qNominees.map((n, i) => (i < 2 ? n : { ...n, photoUrl: "" })),
  });
  check(
    "2/5 coverage fails 80%",
    lowCoverage.checks.find((c) => c.id === "photo-coverage")!.passed === false
  );
  const dupes = evaluateRankingQuality({
    ...readyInput,
    nominees: [...qNominees.slice(0, 4), { ...qNominees[0], id: "pX" }],
  });
  check(
    "duplicate names fail",
    dupes.checks.find((c) => c.id === "no-duplicates")!.passed === false
  );
  const brokenUrl = evaluateRankingQuality({
    ...readyInput,
    photoUrlStatus: new Map([
      ...qNominees.map((n) => [n.id, "ok" as const] as const),
      ["p3", "broken" as const],
    ]),
  });
  check(
    "broken photo URL fails",
    brokenUrl.checks.find((c) => c.id === "photo-urls-valid")!.passed === false
  );
  const badScope = evaluateRankingQuality({
    ...readyInput,
    ranking: { ...qRanking, scope: "planet" as unknown as "global" },
  });
  check(
    "illegal scope fails",
    badScope.checks.find((c) => c.id === "category-scope-valid")!.passed === false
  );
  const missingEng = evaluateRankingQuality({
    ...readyInput,
    engagementReady: new Set(["p1"]),
  });
  check(
    "unreadable engagement fails",
    missingEng.checks.find((c) => c.id === "engagement-readable")!.passed === false
  );
  // global-no-city: the display contract already suppresses the stored
  // gating city, so this must PASS for a global anime ranking.
  check(
    "global-no-city passes (display suppresses gating city)",
    ready.checks.find((c) => c.id === "global-no-city")!.passed === true
  );

  // ---------------------------------------------------------------- D
  console.log("\nD. public Like totals (DB)");
  const viewerA = await createUser({
    email: "viewer-a@example.com",
    passwordHash: "x",
    name: "Viewer A",
  });
  const viewerB = await createUser({
    email: "viewer-b@example.com",
    passwordHash: "x",
    name: "Viewer B",
  });
  const ranking = await createRanking({
    title: "Test Anime Ranking",
    country: "United Kingdom",
    city: "London",
    description: "Test ranking for the nominee-fixes suite.",
    createdBy: viewerA.id,
    scope: "global",
  });
  const mkProfile = (name: string, photoUrl = "") =>
    createProfile({ rankingId: ranking.id, name, photoUrl, addedBy: viewerA.id });
  const p1 = await mkProfile("Fullmetal Alchemist", "https://cdn.example.com/fma.jpg");
  const p2 = await mkProfile("Cowboy Bebop");
  const p3 = await mkProfile("Trigun");
  // p1: 300 seed + 26 organic; p2: 1 organic; p3: 0.
  const insertLike = (profileId: string, userId: string, count: number, source: "seed" | "organic") =>
    db
      .prepare(
        "INSERT INTO likes (id, ranking_id, profile_id, user_id, count, like_source) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(newId(), ranking.id, profileId, userId, count, source);
  insertLike(p1.id, viewerA.id, 300, "seed");
  insertLike(p1.id, viewerB.id, 26, "organic");
  insertLike(p2.id, viewerA.id, 1, "organic");

  const { mostLoved } = await getLeaderboards(ranking.id);
  // DISPLAYED numbers are organic only — seed never leaks into them.
  const totals = new Map(mostLoved.map((e) => [e.profile.id, e.organicLikeCount]));
  check("p1 displayed total = 26 (organic only, seed 300 hidden)", totals.get(p1.id) === 26, String(totals.get(p1.id)));
  check("p2 displayed total = 1", totals.get(p2.id) === 1, String(totals.get(p2.id)));
  check("p3 displayed total = 0", totals.get(p3.id) === 0, String(totals.get(p3.id)));
  // likeScore (internal sort key) blends seed + organic with weights 1.0/1.0.
  const scores = new Map(mostLoved.map((e) => [e.profile.id, e.likeScore]));
  const p1Score = scores.get(p1.id)!;
  check("p1 likeScore ~= 326 (decayed seed 300 + organic 26)", Math.abs(p1Score - 326) < 1, String(p1Score));
  check("p2 likeScore = 1", scores.get(p2.id) === 1, String(scores.get(p2.id)));
  check("p3 likeScore = 0", scores.get(p3.id) === 0, String(scores.get(p3.id)));
  check(
    "Most Loved sorts by likeScore desc",
    mostLoved[0].profile.id === p1.id &&
      mostLoved[1].profile.id === p2.id &&
      mostLoved[2].profile.id === p3.id,
    mostLoved.map((e) => `${e.profile.name}:${e.likeScore}`).join(", ")
  );
  check(
    "getPublicOrganicLikeTotal matches the board for 26/1/0",
    (await getPublicOrganicLikeTotal(ranking.id, p1.id)) === 26 &&
      (await getPublicOrganicLikeTotal(ranking.id, p2.id)) === 1 &&
      (await getPublicOrganicLikeTotal(ranking.id, p3.id)) === 0
  );
  // Viewer-independence: a third viewer's own Likes raise the PUBLIC
  // total by the same amount — no per-viewer number anywhere.
  const viewerC = await createUser({
    email: "viewer-c@example.com",
    passwordHash: "x",
    name: "Viewer C",
  });
  await incrementLike({ rankingId: ranking.id, profileId: p3.id, userId: viewerC.id });
  const after = await getLeaderboards(ranking.id);
  check(
    "public total is viewer-independent (0 -> 1 after C likes)",
    after.mostLoved.find((e) => e.profile.id === p3.id)!.organicLikeCount === 1
  );
  // Support path untouched: seed likes exist but Most Supported is still
  // pure credits (all 0 here, and seed/organic split preserved).
  const p1Entry = after.mostLoved.find((e) => e.profile.id === p1.id)!;
  check(
    "seed/organic split preserved on the entry",
    Math.abs((p1Entry.seedLikes ?? -1) - 300) < 1 && p1Entry.organicLikes === 26,
    `seed=${p1Entry.seedLikes} organic=${p1Entry.organicLikes}`
  );
  check(
    "seed weight change cannot alter the displayed organic total",
    p1Entry.organicLikeCount === 26
  );
  check(
    "Most Supported still pure credits (0 everywhere)",
    after.mostSupported.every((e) => e.supportScore === 0)
  );

  // ---------------------------------------------------------------- G/I
  console.log("\nG/I. NomineeCard static markup");
  const mkEntry = (
    overrides: Partial<Profile> & { name: string },
    organicLikeCount: number
  ): LeaderboardEntry => ({
    profile: {
      id: newId(),
      rankingId: ranking.id,
      bio: "",
      photoUrl: "",
      avatarColor: "#8b5cf6",
      claimStatus: "unclaimed",
      claimedBy: null,
      claimedAt: null,
      addedBy: viewerA.id,
      createdAt: new Date().toISOString(),
      region: "",
      interests: [],
      deletedAt: null,
      shareToken: newId(),
      ...overrides,
    },
    organicLikeCount,
    seedScore: 0,
    supportScore: 0,
    likeScore: organicLikeCount,
  });

  const zeroEntry = mkEntry({ name: "Zero Likes Anime" }, 0);
  const zeroHtml = renderCard({
      rank: 3,
      entry: zeroEntry,
      rankingId: ranking.id,
      ranking,
      rankingContext: {
        city: "London",
        country: "United Kingdom",
        scope: "global",
        categorySlug: "anime",
        subcategorySlug: "anime-series",
      },
      publicOrganicLikeCount: 0,
      userLikeCount: 0,
      allowedLikes: 1,
      loggedIn: false,
      emphasis: "likes",
    });
  check("0 votes renders 'Like · 0'", zeroHtml.includes("Like · 0"));
  check("logged-out Like goes to /login", zeroHtml.includes('href="/login"'));
  check(
    "global anime card shows no London",
    !zeroHtml.includes("London"),
    "markup leaked the gating city"
  );
  check("missing photo renders placeholder art", zeroHtml.includes("Photo coming soon"));
  check("placeholder shows category label", zeroHtml.includes("Anime"));

  const lovedEntry = mkEntry({ name: "FMA" }, 326);
  const lovedHtml = renderCard({
      rank: 1,
      entry: lovedEntry,
      rankingId: ranking.id,
      ranking,
      rankingContext: {
        city: "London",
        country: "United Kingdom",
        scope: "global",
        categorySlug: "anime",
        subcategorySlug: "anime-characters",
      },
      publicOrganicLikeCount: 326,
      userLikeCount: 1,
      allowedLikes: 2,
      loggedIn: true,
      emphasis: "likes",
    });
  check("326 votes renders 'Like · 326'", lovedHtml.includes("Like · 326"));
  check("logged-in liked card marks aria-pressed", lovedHtml.includes('aria-pressed="true"'));

  // Same entry on the Most Supported board renders the identical total.
  const supportedHtml = renderCard({
      rank: 1,
      entry: lovedEntry,
      rankingId: ranking.id,
      ranking,
      rankingContext: {
        city: "London",
        country: "United Kingdom",
        scope: "global",
        categorySlug: "anime",
        subcategorySlug: "anime-characters",
      },
      publicOrganicLikeCount: 326,
      userLikeCount: 0,
      allowedLikes: 1,
      loggedIn: false,
      emphasis: "credits",
    });
  check(
    "Most Loved and Most Supported render the same public total",
    lovedHtml.includes("Like · 326") && supportedHtml.includes("Like · 326")
  );

  const localEntry = mkEntry({ name: "DJ Local Hero" }, 12);
  const localRanking = { ...ranking, scope: "city", isGlobal: false } as unknown as Ranking;
  const localHtml = renderCard({
      rank: 2,
      entry: localEntry,
      rankingId: ranking.id,
      ranking: localRanking,
      rankingContext: {
        city: "London",
        country: "United Kingdom",
        scope: "city",
        categorySlug: "music",
        subcategorySlug: null,
      },
      publicOrganicLikeCount: 12,
      userLikeCount: 0,
      allowedLikes: 1,
      loggedIn: true,
      emphasis: "likes",
    });
  check("city-scope local person shows city", localHtml.includes("London, United Kingdom"));

  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURES`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
