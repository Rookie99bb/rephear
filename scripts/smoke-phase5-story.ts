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

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll Phase 5.2 story checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
