// Phase 5.2 (Support Story) smoke test: story-context support page +
// story-start celebration.
//
// Covers:
//  A. celebrationCopy unit tests: formatTop10Gap (credits-only, no
//     fiat, no supporter-count gaps), buildImpactCopy (real movement
//     only; Top 10 crossing uses the §23-safe wording, never "You
//     moved X into Top 10"), resolveReasonEcho (preset label / custom
//     text / null), wasOutsideTop10AtSupport mapping, buildJourneyLines.
//  B. Dialog source assertions: no "Payment Successful", no
//     formatMoney import, no fiat symbols, no amountCents rendering,
//     headline is the backing headline, journey block present.
//  C. SupportPackages source assertions: Back/Backer copy on the
//     emotional surface (no "❤️ Support" heading), checkout still
//     unambiguous that money moves.
//  D. DB-level: getTop10CreditsThreshold + getRecentCreditsMomentum
//     against a throwaway local SQLite file (seed-excluded, refunded
//     rows contribute 0).
//
// Runs against a throwaway local SQLite file — NEVER production.
// Usage: DATA_DIR=$(mktemp -d /tmp/rephear-p52.XXXXXX) npx tsx scripts/smoke-phase5-story.ts

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DATA_DIR = fs.mkdtempSync(
  path.join(os.tmpdir(), "smoke-phase5-story-")
);

let failures = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.error("  FAIL  " + name + (extra ? " — " + extra : ""));
  }
}

const REPO_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  ".."
);
function srcFile(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

async function main() {
  const {
    formatTop10Gap,
    buildImpactCopy,
    resolveReasonEcho,
    wasOutsideTop10AtSupport,
    buildJourneyLines,
  } = await import("@/lib/celebrationCopy");

  // ── A. Pure copy builders ──────────────────────────────────────────
  check(
    "gap 140 → credits-only copy",
    formatTop10Gap(140) === "140 Credits behind the current Top 10"
  );
  check("gap 0 → null", formatTop10Gap(0) === null);
  check("gap null → null", formatTop10Gap(null) === null);
  check(
    "gap copy has no fiat",
    !/[$£€]/.test(formatTop10Gap(1400) ?? "")
  );
  check(
    "gap copy never mentions supporters",
    !/supporter/i.test(formatTop10Gap(1400) ?? "")
  );

  const noMove = buildImpactCopy({
    profileName: "Mia",
    rankBefore: 12,
    rankAfter: 12,
    gapToTop10: 90,
  });
  check("no movement → impact exists", noMove !== null);
  check(
    "no movement → rank + gap line",
    noMove?.body === "Mia is now #12 in Most Supported. 90 Credits behind the current Top 10."
  );

  const crossing = buildImpactCopy({
    profileName: "Mia",
    rankBefore: 12,
    rankAfter: 10,
    gapToTop10: 0,
  });
  check("real Top 10 entry → trophy headline", crossing?.headline === "🏆 MIA ENTERED THE TOP 10");
  check(
    "crossing uses §23-safe wording (no causation claim)",
    (crossing?.body ?? "").includes("during the climb into the Top 10") &&
      !/you moved/i.test(crossing?.body ?? "")
  );

  const climb = buildImpactCopy({
    profileName: "Mia",
    rankBefore: 25,
    rankAfter: 18,
    gapToTop10: 400,
  });
  check(
    "non-crossing climb → factual rank line",
    climb?.body === "Mia climbed #25 → #18 in Most Supported." &&
      climb.headline === null
  );

  const unknown = buildImpactCopy({
    profileName: "Mia",
    rankBefore: null,
    rankAfter: null,
    gapToTop10: null,
  });
  check("unknown ranks → null (section omitted, never fabricated)", unknown === null);

  check(
    "reason echo: preset label",
    resolveReasonEcho("believe_potential", null) ===
      "🌱 I believe in her potential"
  );
  check(
    "reason echo: custom text",
    resolveReasonEcho("custom", "  she inspires me  ") === "\u201Cshe inspires me\u201D"
  );
  check("reason echo: skipped → null", resolveReasonEcho(null, null) === null);
  check(
    "reason echo: unknown key → null",
    resolveReasonEcho("bogus", null) === null
  );

  check("outside top_10: outside_top_50 → true", wasOutsideTop10AtSupport("outside_top_50"));
  check("outside top_10: unranked → true", wasOutsideTop10AtSupport("unranked"));
  check("outside top_10: top_20 → true", wasOutsideTop10AtSupport("top_20"));
  check("outside top_10: top_10 → false", !wasOutsideTop10AtSupport("top_10"));
  check("outside top_10: number_1 → false", !wasOutsideTop10AtSupport("number_1"));
  check("outside top_10: null → false", !wasOutsideTop10AtSupport(null));

  const journey = buildJourneyLines({
    rankAtSupport: 23,
    totalCreditsAtSupport: 1860,
    backerCountAtSupport: 38,
    backerNumber: 39,
  });
  check(
    "journey lines: snapshot + backer #",
    journey.some((l) => l.includes("ranked #23") && l.includes("1,860 Credits") && l.includes("38 backers")) &&
      journey.some((l) => l === "You became Backer #39")
  );
  check(
    "journey lines: all-null → empty (omitted, never fabricated)",
    buildJourneyLines({
      rankAtSupport: null,
      totalCreditsAtSupport: null,
      backerCountAtSupport: null,
      backerNumber: null,
    }).length === 0
  );

  // ── B. Dialog source assertions ────────────────────────────────────
  // Strip comments first: several comments *assert the ban* by naming
  // the forbidden phrase, which must not trip the check.
  const dialogRaw = srcFile("src/components/SupportCelebrationDialog.tsx");
  const dialog = dialogRaw
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  check("dialog: no 'Payment Successful'", !/Payment Successful/i.test(dialog));
  check("dialog: no formatMoney import", !/formatMoney/.test(dialog));
  // Strip ${...} interpolations first — "$" there is template syntax,
  // not a currency symbol.
  const dialogNoInterp = dialog.replace(/\$\{[^}]*\}/g, "");
  check("dialog: no fiat symbols", !/[$£€]/.test(dialogNoInterp));
  check("dialog: no amountCents rendering", !/data\.amountCents/.test(dialog));
  check(
    "dialog: backing headline",
    dialog.includes("You&apos;re backing") || dialog.includes("You're backing")
  );
  check(
    "dialog: journey block present",
    /When you joined the journey/i.test(dialog)
  );
  check(
    "dialog: derives Backed-Before-Top-10 (no stored flag)",
    dialog.includes("wasOutsideTop10AtSupport") &&
      !/backed_before_top_10/i.test(dialog)
  );

  // ── C. SupportPackages source assertions ───────────────────────────
  const packages = srcFile("src/components/SupportPackages.tsx");
  check(
    "packages: emotional surface uses Backing",
    packages.includes("❤️ Backing")
  );
  check(
    "packages: no '❤️ Support' heading",
    !/❤️ Support/.test(packages)
  );
  check(
    "packages: checkout still unambiguous that money moves",
    /paid action/i.test(packages) && /Stripe/i.test(packages)
  );
  check(
    "packages: CTA is Back-language",
    /Back them/.test(packages)
  );

  // ── D. DB-level: threshold + momentum ──────────────────────────────
  const { ensureMigrated } = await import("@/db/schema");
  const { db } = await import("@/db/client");
  const bcrypt = (await import("bcryptjs")).default;
  const { createUser } = await import("@/db/users");
  const { createRanking } = await import("@/db/rankings");
  const { createProfile } = await import("@/db/profiles");
  const { newId } = await import("@/lib/id");
  const {
    getTop10CreditsThreshold,
    getRecentCreditsMomentum,
    getSupportedRankSnapshot,
  } = await import("@/db/leaderboards");

  await ensureMigrated();
  const stamp = Date.now().toString(36);
  const alice = await createUser({
    email: `p52-${stamp}@example.com`,
    passwordHash: bcrypt.hashSync("password123", 10),
    name: `P52 ${stamp}`,
  });
  const ranking = await createRanking({
    title: `P52 Ranking ${stamp}`,
    country: "UK",
    city: "London",
    description: "smoke",
    createdBy: alice.id,
  });

  // 12 nominees with descending totals: #1=12000 … #12=1000.
  const profiles: { id: string; expected: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const p = await createProfile({
      rankingId: ranking.id,
      name: `P52 Nominee ${i + 1}`,
      addedBy: alice.id,
    });
    profiles.push({ id: p.id, expected: (12 - i) * 1000 });
  }
  async function grantCredits(
    userId: string,
    profileId: string,
    credits: number,
    createdAt: string | null
  ) {
    const pid = newId();
    const txid = newId();
    await db
      .prepare(
        `INSERT INTO payments (id, user_id, ranking_id, profile_id, package_id, credits, amount_cents, currency, stripe_checkout_session_id, status) VALUES (?, ?, ?, ?, 'smoke', ?, ?, 'usd', ?, 'completed')`
      )
      .run(pid, userId, ranking.id, profileId, credits, credits * 10, `sess-${pid}`);
    await db
      .prepare(
        `INSERT INTO credit_transactions (id, profile_id, ranking_id, supporter_user_id, payment_id, credits${createdAt ? ", created_at" : ""}) VALUES (?, ?, ?, ?, ?, ?${createdAt ? ", ?" : ""})`
      )
      .run(
        txid,
        profileId,
        ranking.id,
        userId,
        pid,
        credits,
        ...(createdAt ? [createdAt] : [])
      );
  }
  // #10 gets 3000 → threshold must be 3000.
  for (const p of profiles) {
    await grantCredits(alice.id, p.id, p.expected, null);
  }
  // One stale grant (30 days ago) to #12 — must NOT count as momentum.
  await grantCredits(
    alice.id,
    profiles[11].id,
    500,
    "2026-01-01 00:00:00"
  );
  // One seed-account grant to #1 — must be excluded from backer counts
  // and momentum everywhere (totals keep it: the ledger is append-only
  // and board totals are seed-inclusive, only identity/backer counts
  // exclude seeds).
  const seedId = `seed_community_smoke52_${stamp}`;
  await db
    .prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`)
    .run(seedId, `seed52-${stamp}@example.com`, "x", "Seed Community");
  await grantCredits(seedId, profiles[0].id, 7000, null);

  const threshold = await getTop10CreditsThreshold(ranking.id);
  check("top-10 threshold = #10 total (3000)", threshold === 3000, `got ${threshold}`);

  const momentum12 = await getRecentCreditsMomentum(ranking.id, profiles[11].id);
  check(
    "momentum: stale grant excluded (only fresh 1000)",
    momentum12 === 1000,
    `got ${momentum12}`
  );
  const momentum1 = await getRecentCreditsMomentum(ranking.id, profiles[0].id);
  check(
    "momentum: seed grant excluded (12000, not 19000)",
    momentum1 === 12000,
    `got ${momentum1}`
  );

  const snap12 = await getSupportedRankSnapshot(ranking.id, profiles[11].id);
  check("snapshot rank for #12", snap12?.rank === 12, `got ${snap12?.rank}`);
  check(
    "snapshot total for #12 (1000 fresh + 500 stale = 1500)",
    snap12?.totalCredits === 1500,
    `got ${snap12?.totalCredits}`
  );
  check(
    "snapshot backer count for #12 (1)",
    snap12?.supporterCount === 1,
    `got ${snap12?.supporterCount}`
  );
  const snap1 = await getSupportedRankSnapshot(ranking.id, profiles[0].id);
  check(
    "snapshot backer count for #1 excludes seed (1)",
    snap1?.supporterCount === 1,
    `got ${snap1?.supporterCount}`
  );

  // Small ranking (< 10 nominees) → threshold null.
  const smallRanking = await createRanking({
    title: `P52 Small ${stamp}`,
    country: "UK",
    city: "London",
    description: "smoke",
    createdBy: alice.id,
  });
  const smallThreshold = await getTop10CreditsThreshold(smallRanking.id);
  check("threshold null when < 10 nominees", smallThreshold === null);

  // ── E. Phase 5.3: My Backing Stories + People I Back v2 ──────────
  const {
    formatStoryDate,
    buildBeforeAfterCopy,
    wasProvenClimb,
    buildEarlyBadgeCopy,
    buildRankArrow,
    humanizeGrowthStage,
    buildJourneyProgressCopy,
    resolveStoryReasonEcho,
  } = await import("@/lib/storyCopy");
  const { getBackingStories, getPersonStoryEnrichment } = await import(
    "@/db/backingStories"
  );
  const { getPeopleIBack: getPeopleIBack53 } = await import(
    "@/db/publicProfiles"
  );
  const { recordConviction: recordConviction53 } = await import(
    "@/db/convictionRecords"
  );
  const { recordBackingMoment: recordBackingMoment53 } = await import(
    "@/db/backingMoments"
  );

  // E1. Pure copy builders.
  check(
    "before/after: #23 → #3",
    buildBeforeAfterCopy({ profileName: "Mia", rankAtSupport: 23, currentRank: 3 }) ===
      "You backed Mia at #23. Mia is now #3."
  );
  check(
    "before/after: unknown rank → null (never fabricated)",
    buildBeforeAfterCopy({ profileName: "Mia", rankAtSupport: null, currentRank: 3 }) === null
  );
  check("proven climb: 23 → 3", wasProvenClimb(23, 3) === true);
  check("proven climb: flat 5 → 5 is not a climb", wasProvenClimb(5, 5) === false);
  check("proven climb: declined 4 → 9 is not a climb", wasProvenClimb(4, 9) === false);
  check("proven climb: unknown → false", wasProvenClimb(null, 3) === false);
  check(
    "early badge: proven climb only",
    buildEarlyBadgeCopy(23, 3) === "🏆 I Was There Early"
  );
  check("early badge: declined → null", buildEarlyBadgeCopy(4, 9) === null);
  check("early badge: flat → null", buildEarlyBadgeCopy(5, 5) === null);
  check("rank arrow: declined renders honestly", buildRankArrow(4, 9) === "#4 → #9");
  check("story date formats", formatStoryDate("2026-09-30 01:23:45") === "Sep 30, 2026");
  check("growth stage label", humanizeGrowthStage("top_50") === "Top 50");
  check("growth stage: null → null", humanizeGrowthStage(null) === null);
  check(
    "journey progress: Top 50 → Top 3",
    buildJourneyProgressCopy("top_50", "top_3") === "Top 50 → Top 3"
  );
  check(
    "journey progress: same stage → single label",
    buildJourneyProgressCopy("top_10", "top_10") === "Top 10"
  );
  check(
    "journey progress: unknown → null",
    buildJourneyProgressCopy(null, "top_3") === null
  );
  check(
    "reason echo: preset label",
    resolveStoryReasonEcho("believe_potential", null) ===
      "🌱 I believe in her potential"
  );
  check(
    "reason echo: custom text quoted",
    resolveStoryReasonEcho("custom", "she moves me") === "\u201Cshe moves me\u201D"
  );
  check(
    "reason echo: skipped → null",
    resolveStoryReasonEcho(null, null) === null
  );

  // E2. DB fixtures: carol (owner), dave (viewer), seed backer.
  const carol = await createUser({
    email: `p53-carol-${stamp}@example.com`,
    passwordHash: bcrypt.hashSync("password123", 10),
    name: `P53 Carol ${stamp}`,
  });
  const dave = await createUser({
    email: `p53-dave-${stamp}@example.com`,
    passwordHash: bcrypt.hashSync("password123", 10),
    name: `P53 Dave ${stamp}`,
  });
  const seed53 = `seed_community_smoke53_${stamp}`;
  await db
    .prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`)
    .run(seed53, `seed53-${stamp}@example.com`, "x", "Seed Community");

  // One full support: payment + credit row + conviction + moment.
  // vis "inherit" = NULL credit-row visibility (follows the user's
  // show_supports at read time). payments.visibility_choice is NOT NULL
  // (resolved at checkout: explicit choice → user's default → public).
  async function mkSupport(opts: {
    userId: string;
    profileId: string;
    credits: number;
    vis: "public" | "private" | "inherit";
    reason?: string | null;
    reasonText?: string | null;
    withMoment: boolean;
    rankAtSupport?: number | null;
  }) {
    const pid = newId();
    const payVis = opts.vis === "private" ? "private" : "public";
    const ctVis = opts.vis === "inherit" ? null : payVis;
    await db
      .prepare(
        `INSERT INTO payments (id, user_id, ranking_id, profile_id, package_id, credits, amount_cents, currency, stripe_checkout_session_id, status, visibility_choice, support_reason, support_reason_text)
         VALUES (?, ?, ?, ?, 'smoke', ?, ?, 'gbp', ?, 'completed', ?, ?, ?)`
      )
      .run(
        pid, opts.userId, ranking.id, opts.profileId, opts.credits,
        opts.credits * 10, `sess-${pid}`, payVis,
        opts.reason ?? null, opts.reasonText ?? null
      );
    await db
      .prepare(
        `INSERT INTO credit_transactions (id, profile_id, ranking_id, supporter_user_id, payment_id, credits, visibility)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(newId(), opts.profileId, ranking.id, opts.userId, pid, opts.credits, ctVis);
    await recordConviction53({
      userId: opts.userId,
      rankingId: ranking.id,
      profileId: opts.profileId,
      rankAtSupport: opts.rankAtSupport ?? null,
      supporterCountAtSupport: 5,
      paymentId: pid,
      amountCents: opts.credits * 10,
      currency: "gbp",
      visibility: opts.vis === "private" ? "private" : "public",
    });
    if (opts.withMoment) {
      await recordBackingMoment53({
        userId: opts.userId,
        rankingId: ranking.id,
        profileId: opts.profileId,
        paymentId: pid,
        credits: opts.credits,
        rankAtSupport: opts.rankAtSupport ?? null,
        totalCreditsAtSupport: 820,
        backerCountAtSupport: 31,
        supportReason: opts.reason ?? null,
        supportReasonText: opts.reasonText ?? null,
        visibilityAtSupport: "public",
      });
    }
    return pid;
  }

  // Carol's three supports on the 12-nominee board (#1=12000 … #12=1000):
  //  - profiles[4] (#5): public moment, climbed #9 → #5 (proven climb).
  //  - profiles[8] (#9): PRIVATE moment, declined #4 → #9, custom reason.
  //  - profiles[10] (#11): conviction only → legacy entry, #12 → #11.
  await mkSupport({
    userId: carol.id, profileId: profiles[4].id, credits: 50,
    vis: "inherit", reason: "believe_potential", withMoment: true, rankAtSupport: 9,
  });
  await mkSupport({
    userId: carol.id, profileId: profiles[8].id, credits: 50,
    vis: "private", reason: "custom", reasonText: "she moves me",
    withMoment: true, rankAtSupport: 4,
  });
  await mkSupport({
    userId: carol.id, profileId: profiles[10].id, credits: 50,
    vis: "inherit", withMoment: false, rankAtSupport: 12,
  });
  // Seed backer's moment must never surface anywhere.
  await mkSupport({
    userId: seed53, profileId: profiles[0].id, credits: 50,
    vis: "inherit", reason: "love_work", withMoment: true, rankAtSupport: 1,
  });

  // E3. Owner sees everything, including the private moment + custom text.
  const ownerStories = await getBackingStories(carol.id, carol.id);
  check("owner sees all 3 stories", ownerStories.length === 3, `got ${ownerStories.length}`);
  const ownerMoments = ownerStories.filter((s) => s.kind === "moment");
  const ownerLegacy = ownerStories.filter((s) => s.kind === "legacy");
  check("owner: 2 moments + 1 legacy", ownerMoments.length === 2 && ownerLegacy.length === 1);
  const privMoment = ownerMoments.find((s) => s.profileId === profiles[8].id);
  check(
    "owner: private moment's custom text visible to owner",
    privMoment?.kind === "moment" && privMoment.supportReasonText === "she moves me"
  );
  const climbMoment = ownerMoments.find((s) => s.profileId === profiles[4].id);
  check(
    "owner: climb moment THEN→NOW (#9 → #5)",
    climbMoment?.kind === "moment" &&
      climbMoment.rankAtSupport === 9 &&
      climbMoment.currentRank === 5
  );
  check(
    "owner: decline moment keeps honest ranks (#4 → #9)",
    privMoment?.kind === "moment" &&
      privMoment.rankAtSupport === 4 &&
      privMoment.currentRank === 9
  );
  const legacy = ownerLegacy[0];
  check(
    "owner: legacy entry has real first-support fields only",
    legacy?.kind === "legacy" &&
      legacy.rankAtFirstSupport === 12 &&
      legacy.currentRank === 11 &&
      !("totalCreditsAtSupport" in legacy) &&
      !("backerNumber" in legacy) &&
      !("supportReason" in legacy)
  );
  const seedTargetStories = await getBackingStories(dave.id, seed53);
  check(
    "seed moment never surfaces in anyone's stories",
    seedTargetStories.length === 0 &&
      !ownerStories.some((s) => s.profileId === profiles[0].id),
    `seed-target stories: ${seedTargetStories.length}`
  );

  // E4. Another viewer: public-only, no custom text, no private moment.
  const viewerStories = await getBackingStories(dave.id, carol.id);
  check("viewer sees 2 stories (public only)", viewerStories.length === 2, `got ${viewerStories.length}`);
  check(
    "viewer: private moment excluded",
    !viewerStories.some((s) => s.profileId === profiles[8].id)
  );
  check(
    "viewer: custom text never leaks",
    viewerStories.every(
      (s) => s.kind !== "moment" || (s as { supportReasonText: string | null }).supportReasonText === null
    )
  );
  check(
    "viewer: legacy entry visible (inherited public)",
    viewerStories.some((s) => s.kind === "legacy" && s.profileId === profiles[10].id)
  );

  // E5. Flip carol's default to private → the inherited-visibility
  // moment hides retroactively for viewers (read-time COALESCE). The
  // legacy entry keeps Phase 2's first-wins semantics (resolved public
  // choice at first support), exactly like its People I Back row.
  await db.prepare(`UPDATE users SET show_supports = 'private' WHERE id = ?`).run(carol.id);
  const viewerAfterFlip = await getBackingStories(dave.id, carol.id);
  check(
    "flip to private: inherited moment hides, legacy keeps first-wins",
    viewerAfterFlip.length === 1 &&
      viewerAfterFlip[0].kind === "legacy" &&
      viewerAfterFlip[0].profileId === profiles[10].id,
    `got ${viewerAfterFlip.length}`
  );
  const ownerAfterFlip = await getBackingStories(carol.id, carol.id);
  check("flip to private: owner still sees all 3", ownerAfterFlip.length === 3);
  await db.prepare(`UPDATE users SET show_supports = 'public' WHERE id = ?`).run(carol.id);

  // E6. People I Back v2 enrichment.
  const pibOwner = await getPeopleIBack53(carol.id, carol.id);
  const pibClimb = pibOwner.find((r) => r.profileId === profiles[4].id);
  check(
    "pib v2: latest reason preset on public triple",
    pibClimb?.latestReason === "believe_potential"
  );
  check(
    "pib v2: journey progress top_10 → top_10",
    pibClimb?.journeyFrom === "top_10" && pibClimb?.journeyTo === "top_10",
    `got ${pibClimb?.journeyFrom} → ${pibClimb?.journeyTo}`
  );
  const pibPriv = pibOwner.find((r) => r.profileId === profiles[8].id);
  check(
    "pib v2: owner sees own custom reason text",
    pibPriv?.latestReason === "custom" && pibPriv?.latestReasonText === "she moves me"
  );
  const pibViewer = await getPeopleIBack53(dave.id, carol.id);
  check(
    "pib v2: viewer rows exclude the private triple",
    !pibViewer.some((r) => r.profileId === profiles[8].id)
  );

  // E7. Per-moment enrichment privacy gate.
  const enrichPrivViewer = await getPersonStoryEnrichment(dave.id, carol.id, ranking.id, profiles[8].id);
  check(
    "enrichment: viewer gets nothing from a private triple",
    enrichPrivViewer.latestReason === null && enrichPrivViewer.firstGrowthStage === null
  );
  const enrichPubViewer = await getPersonStoryEnrichment(dave.id, carol.id, ranking.id, profiles[4].id);
  check(
    "enrichment: viewer gets preset + stage from a public triple",
    enrichPubViewer.latestReason === "believe_potential" && enrichPubViewer.firstGrowthStage === "top_10"
  );

  // E8. Source assertions: render path uses read-time visibility only.
  const storiesDb = srcFile("src/db/backingStories.ts");
  check(
    "stories db: read-time effective visibility (COALESCE ct.visibility)",
    storiesDb.includes("COALESCE(ct.visibility, u.show_supports, 'public')")
  );
  const storiesSection = srcFile("src/components/BackingStoriesSection.tsx");
  check(
    "stories section: titled My Backing Stories",
    storiesSection.includes("My Backing Stories")
  );
  check(
    "stories section: no transaction/purchase language",
    !/Transactions|Purchase History|Spending|Payment History/i.test(storiesSection)
  );
  check(
    "stories section: never reads visibility_at_support",
    !/visibility_at_support/.test(storiesSection)
  );
  const profilePage = srcFile("src/app/u/[id]/page.tsx");
  check(
    "profile page: renders BackingStoriesSection",
    profilePage.includes("<BackingStoriesSection")
  );
  const pibSection = srcFile("src/components/PeopleIBackSection.tsx");
  check("people i back: View Story links", pibSection.includes("View Story"));
  check("people i back: story anchors", /#story-/.test(pibSection));
  check(
    "people i back: no transaction/purchase language",
    !/Transactions|Purchase History|Spending|Payment History/i.test(pibSection)
  );

  // ── F. Phase 5.4: Journey Timeline + YOU JOINED HERE + Community ──
  const {
    buildMilestoneLabel,
    buildJoinMarkerCopy,
  } = await import("@/lib/storyCopy");
  const {
    getJourneyTimeline,
    getViewerJoinMarker,
    getRoadToTop3,
    getTop3Challengers,
    getCommunityStory,
  } = await import("@/db/journeyTimeline");
  const { recordMilestoneEvent } = await import("@/db/milestones");

  // F1. Pure copy builders: labels, no fiat, no causal claims.
  check(
    "milestone label: nominated with rank",
    buildMilestoneLabel("nominated", 48) === "Nominated (#48)"
  );
  check(
    "milestone label: first_1k_credits",
    buildMilestoneLabel("first_1k_credits", null) === "First 1,000 Support Credits"
  );
  check(
    "milestone label: backers_50",
    buildMilestoneLabel("backers_50", null) === "50 Backers"
  );
  check(
    "milestone label: entered_top_10 with rank",
    buildMilestoneLabel("entered_top_10", 9) === "Entered the Top 10 (#9)"
  );
  check(
    "milestone label: reached_3",
    buildMilestoneLabel("reached_3", 3) === "Reached #3"
  );
  check(
    "milestone label: reached_1",
    buildMilestoneLabel("reached_1", 1) === "Reached #1"
  );
  check(
    "milestone label: unknown type degrades neutrally",
    buildMilestoneLabel("some_future_type", null) === "Milestone"
  );
  check(
    "milestone labels: no fiat symbols",
    ["nominated", "first_1k_credits", "backers_50", "entered_top_50", "entered_top_20", "entered_top_10", "credits_10k", "reached_3", "reached_1"].every(
      (t) => !/[$£€]/.test(buildMilestoneLabel(t, 5))
    )
  );
  check(
    "join marker: backed at rank",
    buildJoinMarkerCopy("Mia", 23) === "You backed Mia at #23"
  );
  check(
    "join marker: unranked at support",
    buildJoinMarkerCopy("Mia", null) === "You backed Mia before they ranked"
  );
  check(
    "join marker: no causal claims",
    !/moved|caused|made her/i.test(buildJoinMarkerCopy("Mia", 23))
  );

  // F2. Fixture milestone events (factual source only).
  // profiles[4] (#5): nominated → 1k credits → top 10 → reached #3.
  // profiles[0] (#1): nominated → top 10 → reached #3 → reached #1.
  // profiles[8] (#9): nominated only (never reached top 3).
  // profiles[5] (#6): backers_50 (community feed).
  const ev54 = [
    { p: 4, t: "nominated", rank: 48 },
    { p: 4, t: "first_1k_credits", rank: 31 },
    { p: 4, t: "entered_top_10", rank: 9 },
    { p: 4, t: "reached_3", rank: 3 },
    { p: 0, t: "nominated", rank: 60 },
    { p: 0, t: "entered_top_10", rank: 8 },
    { p: 0, t: "reached_3", rank: 3 },
    { p: 0, t: "reached_1", rank: 1 },
    { p: 8, t: "nominated", rank: 55 },
    { p: 5, t: "backers_50", rank: 6 },
  ] as const;
  for (const e of ev54) {
    await recordMilestoneEvent({
      rankingId: ranking.id,
      profileId: profiles[e.p].id,
      type: e.t,
      rankAtEvent: e.rank,
      creditsAtEvent: e.t === "first_1k_credits" ? 1000 : null,
      backersAtEvent: e.t === "backers_50" ? 50 : null,
    });
  }
  // Deterministic chronology for profiles[4]'s trail.
  const order4 = ["nominated", "first_1k_credits", "entered_top_10", "reached_3"];
  for (let i = 0; i < order4.length; i++) {
    await db
      .prepare(
        `UPDATE milestone_events SET created_at = ? WHERE ranking_id = ? AND profile_id = ? AND type = ?`
      )
      .run(`2026-02-0${i + 1} 10:00:00`, ranking.id, profiles[4].id, order4[i]);
  }

  // F3. Timeline renders only real events, chronological, gaps stay empty.
  const tl4 = await getJourneyTimeline(ranking.id, profiles[4].id);
  check(
    "timeline: 4 real events for #5",
    tl4.length === 4,
    `got ${tl4.length}`
  );
  check(
    "timeline: chronological earliest → latest",
    tl4.map((e) => e.type).join(",") === order4.join(","),
    `got ${tl4.map((e) => e.type).join(",")}`
  );
  const tl8 = await getJourneyTimeline(ranking.id, profiles[8].id);
  check(
    "timeline: nominated-only nominee shows 1 entry",
    tl8.length === 1 && tl8[0].type === "nominated"
  );
  const tl2 = await getJourneyTimeline(ranking.id, profiles[2].id);
  check("timeline: no events → empty (no render)", tl2.length === 0);

  // F4. YOU JOINED HERE: strictly per-viewer, first moment wins.
  const carolMarker4 = await getViewerJoinMarker(carol.id, ranking.id, profiles[4].id);
  check(
    "marker: carol's own first moment on #5",
    carolMarker4 !== null && carolMarker4.rankAtSupport === 9 && carolMarker4.isPublic === true
  );
  const carolMarker8 = await getViewerJoinMarker(carol.id, ranking.id, profiles[8].id);
  check(
    "marker: carol's private moment still visible to her (lock path)",
    carolMarker8 !== null && carolMarker8.isPublic === false
  );
  const daveMarker4 = await getViewerJoinMarker(dave.id, ranking.id, profiles[4].id);
  check("marker: dave never backed #5 → null", daveMarker4 === null);
  const anonMarker = await getViewerJoinMarker(null, ranking.id, profiles[4].id);
  check("marker: logged-out → null", anonMarker === null);
  const seedMarker = await getViewerJoinMarker(seed53, ranking.id, profiles[0].id);
  check("marker: seed account → null", seedMarker === null);
  // Dave backs #6 twice; the FIRST moment wins, deterministically.
  await mkSupport({
    userId: dave.id, profileId: profiles[5].id, credits: 50,
    vis: "inherit", withMoment: true, rankAtSupport: 11,
  });
  await mkSupport({
    userId: dave.id, profileId: profiles[5].id, credits: 60,
    vis: "inherit", withMoment: true, rankAtSupport: 6,
  });
  await db
    .prepare(
      `UPDATE backing_moments SET supported_at = '2026-01-01 00:00:00', rank_at_support = 20
       WHERE user_id = ? AND profile_id = ? AND credits = 50`
    )
    .run(dave.id, profiles[5].id);
  const daveMarker5 = await getViewerJoinMarker(dave.id, ranking.id, profiles[5].id);
  check(
    "marker: first moment wins (rank 20, not 6)",
    daveMarker5 !== null && daveMarker5.rankAtSupport === 20,
    `got ${daveMarker5?.rankAtSupport}`
  );

  // F5. Road to Top 3: only reachers, with trails.
  const roads = await getRoadToTop3(ranking.id);
  check(
    "road: #1 and #5 present (both reached #3)",
    roads.some((r) => r.profileId === profiles[0].id) &&
      roads.some((r) => r.profileId === profiles[4].id),
    `got ${roads.map((r) => r.profileId).join(",")}`
  );
  check(
    "road: #9 excluded (never reached Top 3)",
    !roads.some((r) => r.profileId === profiles[8].id)
  );
  const road1 = roads.find((r) => r.profileId === profiles[0].id);
  check(
    "road: #1 trail has 4 events incl. reached_1",
    !!road1 && road1.trail.length === 4 && road1.trail[3].type === "reached_1"
  );

  // F6. Challengers: ranks 4–10 with credits, gap to #3.
  const challengers = await getTop3Challengers(ranking.id);
  check("challengers: 7 (ranks 4–10)", challengers.length === 7, `got ${challengers.length}`);
  const ch4 = challengers.find((c) => c.profileId === profiles[3].id);
  check(
    "challenger: #4 gap to #3 is 1000 credits",
    ch4?.rank === 4 && ch4.gapToThird === 1000,
    `got rank ${ch4?.rank} gap ${ch4?.gapToThird}`
  );
  check(
    "challengers: credits-only, no fiat",
    challengers.every((c) => c.totalCredits > 0 && c.gapToThird !== null)
  );

  // F7. Community: counts only, backer milestones over time.
  const community = await getCommunityStory(ranking.id);
  check("community: total backers > 0", community.totalBackers > 0, `got ${community.totalBackers}`);
  check(
    "community: backers_50 milestone for #6 present",
    community.milestones.some((m) => m.profileId === profiles[5].id && m.backersAtEvent === 50)
  );

  // F8. Source assertions: mounts, no fiat, no causal/guarantee copy.
  const journeyTimeline = srcFile("src/components/JourneyTimeline.tsx");
  check("timeline component: no fiat symbols", !/[$£€]/.test(journeyTimeline.replace(/\$\{/g, "")));
  check(
    "timeline component: no causal claims",
    !/you moved|you caused|made them/i.test(journeyTimeline)
  );
  check(
    "timeline component: YOU JOINED HERE marker",
    journeyTimeline.includes("YOU JOINED HERE")
  );
  check(
    "timeline component: private lock for owner",
    journeyTimeline.includes("🔒")
  );
  const roadSection = srcFile("src/components/RoadToTop3.tsx");
  check(
    "road/community: no guarantee promises",
    !/guarantee|will reach|definitely/i.test(roadSection)
  );
  check(
    "road/community: no backer names rendered",
    !/backerName|supporterName/i.test(roadSection)
  );
  check(
    "road/community: credits-only (no fiat)",
    !/[$£€]/.test(roadSection.replace(/\$\{/g, ""))
  );
  const uPage = srcFile("src/app/u/[id]/page.tsx");
  check("u page: mounts JourneyTimeline", uPage.includes("<JourneyTimeline"));
  const nomineePage = srcFile("src/app/profiles/[id]/page.tsx");
  check("nominee page: mounts JourneyTimeline", nomineePage.includes("<JourneyTimeline"));
  const rankingPage = srcFile("src/app/rankings/[id]/page.tsx");
  check(
    "ranking page: mounts RoadToTop3Section + CommunitySection",
    rankingPage.includes("<RoadToTop3Section") && rankingPage.includes("<CommunitySection")
  );
  const journeyDb = srcFile("src/db/journeyTimeline.ts");
  check(
    "journey db: read-time visibility (COALESCE ct.visibility)",
    journeyDb.includes("COALESCE(ct.visibility, u.show_supports, 'public')")
  );
  check(
    "journey db: never selects visibility_at_support (audit-only)",
    !/visibility_at_support\s*(AS|,|FROM|WHERE|=)/i.test(journeyDb) &&
      !/SELECT[^;]*visibility_at_support/i.test(journeyDb)
  );
  check(
    "journey db: seed excluded",
    journeyDb.includes("notSeedClause")
  );

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll Phase 5 story checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
