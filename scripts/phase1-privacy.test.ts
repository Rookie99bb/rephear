// Phase 1 (v2 redesign) privacy-foundation regression suite.
//
// Run: DATA_DIR=$(mktemp -d) npx tsx scripts/phase1-privacy.test.ts
// (or: npm run test:phase1 — the script sets its own temp DATA_DIR)
//
// The harness boots a FRESH database (no seed content is assumed; the
// suite builds its own fixtures), runs ensureMigrated() twice to prove
// migration idempotency, then checks the Phase 1 privacy guarantees:
//
//  A. Private Likes still count fully in Most Loved totals.
//  B. Private paid Supports still count fully in Most Supported totals.
//  C. Supporter summary: total includes private supporters, public
//     identities list only effective-public supporters, seed_community_*
//     accounts are excluded, and nothing leaks a "N private" count.
//  D. Visibility survives the full checkout → payment → webhook path,
//     and the conviction first snapshot is immutable under repeat
//     Support and webhook redelivery.
//  E. effectiveVisibility(): explicit action choice beats the user's
//     account default; absent choice falls back to the default.
//  F. Currency plumbing: usd|gbp validation, no-FX unit rate, payment
//     row stores the charged currency.
//  G. User visibility defaults: get/set round-trip.
import { ensureMigrated } from "../src/db/schema";
import { createUser, setUserVisibility, getUserVisibility } from "../src/db/users";
import { createRanking } from "../src/db/rankings";
import { createProfile } from "../src/db/profiles";
import { addLike } from "../src/db/likes";
import {
  createPendingPayment,
  markPaymentCompleted,
  findPaymentBySessionId,
} from "../src/db/payments";
import {
  creditProfileForPayment,
  getSupporterSummary,
} from "../src/db/creditTransactions";
import {
  getMostLoved,
  getSupportedRankSnapshot,
} from "../src/db/leaderboards";
import { recordConviction, getConvictionRecord } from "../src/db/convictionRecords";
import { effectiveVisibility, isVisibility } from "../src/db/visibility";
import {
  isSupportCurrency,
  creditsPerUnit,
  CREDITS_PER_DOLLAR,
  CREDITS_PER_POUND,
} from "../src/lib/creditPackages";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ok - ${name}`);
  } else {
    failures++;
    console.error(`  FAIL - ${name}${detail ? `: ${detail}` : ""}`);
  }
}

async function main() {
  console.log("== Phase 1 privacy regression ==");

  // --- Migration idempotency (twice, fresh DB) ---
  await ensureMigrated();
  await ensureMigrated();
  console.log("  ok - ensureMigrated() ran twice without error");

  // --- Fixtures ---
  const admin = await createUser({
    email: "phase1-admin@test.local",
    passwordHash: "x",
    name: "Phase1 Admin",
  });
  const ranking = await createRanking({
    title: "Phase 1 Privacy Test Ranking",
    country: "United Kingdom",
    city: "London",
    description: "test",
    createdBy: admin.id,
  });
  const nominee = await createProfile({
    rankingId: ranking.id,
    name: "Phase1 Nominee",
    addedBy: admin.id,
  });
  const nominee2 = await createProfile({
    rankingId: ranking.id,
    name: "Phase1 Nominee Two",
    addedBy: admin.id,
  });

  const publicLiker = await createUser({ email: "pliker@test.local", passwordHash: "x", name: "Public Liker" });
  const privateLiker = await createUser({ email: "vliker@test.local", passwordHash: "x", name: "Private Liker" });
  const publicSupporter = await createUser({ email: "psup@test.local", passwordHash: "x", name: "Public Supporter" });
  const privateSupporter = await createUser({ email: "vsup@test.local", passwordHash: "x", name: "Private Supporter" });
  // Synthetic seed accounts are identified by their ID prefix
  // (seed_community_*), exactly like the real seedFakeLikes accounts —
  // see seedAccountExclusion() in src/db/visibility.ts.
  const { db } = await import("../src/db/client");
  await db
    .prepare(
      `INSERT OR IGNORE INTO users (id, email, password_hash, name, is_admin)
       VALUES ('seed_community_99', 'seed_community_99@seed.rephear.local', '', 'RepHear Community', 0)`
    )
    .run();
  const seedAccount = { id: "seed_community_99" };

  // --- A. Private Likes count in Most Loved ---
  await addLike({ rankingId: ranking.id, profileId: nominee.id, userId: publicLiker.id, visibility: "public" });
  await addLike({ rankingId: ranking.id, profileId: nominee.id, userId: privateLiker.id, visibility: "private" });
  const loved = await getMostLoved(ranking.id);
  const lovedEntry = loved.find((e) => e.profile.id === nominee.id);
  check("A1 private Like counts in Most Loved total", lovedEntry?.likeCount === 2, `got ${lovedEntry?.likeCount}`);

  // --- B. Private paid Support counts in Most Supported ---
  async function paidSupport(userId: string, tag: string, credits: number, visibility: "public" | "private") {
    const p = await createPendingPayment({
      userId, rankingId: ranking.id, profileId: nominee.id,
      packageId: "custom", credits, amountCents: credits * 10, currency: "usd",
      visibilityChoice: visibility, stripeCheckoutSessionId: `cs_phase1_${tag}`,
    });
    await markPaymentCompleted(p.id, `pi_phase1_${tag}`);
    return p;
  }
  const pA = await paidSupport(publicSupporter.id, "a", 100, "public");
  const pB = await paidSupport(privateSupporter.id, "b", 250, "private");
  const pSeed = await paidSupport(seedAccount.id, "seed", 50, "public");
  const granted1 = await creditProfileForPayment({
    profileId: nominee.id, rankingId: ranking.id, supporterUserId: publicSupporter.id,
    paymentId: pA.id, credits: 100, visibility: "public",
  });
  const granted2 = await creditProfileForPayment({
    profileId: nominee.id, rankingId: ranking.id, supporterUserId: privateSupporter.id,
    paymentId: pB.id, credits: 250, visibility: "private",
  });
  // Seed accounts' credits count too (they're only excluded from IDENTITY queries)
  const grantedSeed = await creditProfileForPayment({
    profileId: nominee.id, rankingId: ranking.id, supporterUserId: seedAccount.id,
    paymentId: pSeed.id, credits: 50, visibility: "public",
  });
  check("B1 credits granted", granted1 && granted2 && grantedSeed);
  const snapB = await getSupportedRankSnapshot(ranking.id, nominee.id);
  check("B2 private Support counts in credit total", snapB?.totalCredits === 400, `got ${snapB?.totalCredits}`);

  // --- C. Privacy-safe supporter summary ---
  const summary = await getSupporterSummary(ranking.id, nominee.id, 10);
  check("C1 total supporters includes private (2 real)", summary.totalSupporters === 2, `got ${summary.totalSupporters}`);
  check(
    "C2 public identities list only the public supporter",
    summary.publicSupporters.length === 1 && summary.publicSupporters[0].name === "Public Supporter",
    JSON.stringify(summary.publicSupporters)
  );
  const summaryJson = JSON.stringify(summary);
  check("C3 no private count leaked", !/private/i.test(summaryJson), summaryJson);
  check("C4 no seed account leaked", !/seed_community/i.test(summaryJson), summaryJson);

  // --- D. Full checkout → webhook path with GBP + private visibility ---
  // (mirrors src/app/api/stripe/webhook/route.ts logic exactly)
  const payment = await createPendingPayment({
    userId: privateSupporter.id,
    rankingId: ranking.id,
    profileId: nominee2.id,
    packageId: "custom",
    credits: 50,
    amountCents: 500,
    currency: "gbp",
    visibilityChoice: "private",
    stripeCheckoutSessionId: "cs_phase1_gbp",
  });
  const fetched = await findPaymentBySessionId("cs_phase1_gbp");
  check("D1 payment persists visibilityChoice + currency", fetched?.visibilityChoice === "private" && fetched?.currency === "gbp");

  await markPaymentCompleted(payment.id, "pi_phase1_gbp");
  const completedPayment = await findPaymentBySessionId("cs_phase1_gbp");
  check("D2 payment marked completed", completedPayment?.status === "completed");

  // Webhook body, first delivery
  const snapshotBefore = await getSupportedRankSnapshot(ranking.id, nominee2.id);
  const granted3 = await creditProfileForPayment({
    profileId: nominee2.id, rankingId: ranking.id, supporterUserId: privateSupporter.id,
    paymentId: payment.id, credits: payment.credits, visibility: payment.visibilityChoice,
  });
  if (granted3) {
    await recordConviction({
      userId: payment.userId, rankingId: payment.rankingId, profileId: payment.profileId,
      rankAtSupport: snapshotBefore?.rank ?? null,
      supporterCountAtSupport: snapshotBefore?.supporterCount ?? null,
      paymentId: payment.id,
      amountCents: payment.amountCents,
      currency: payment.currency,
      visibility: payment.visibilityChoice,
    });
  }
  const creditRows = await getSupporterSummary(ranking.id, nominee2.id, 10);
  check("D3 private supporter hidden from public identities", creditRows.publicSupporters.length === 0 && creditRows.totalSupporters === 1);

  const conv1 = await getConvictionRecord(privateSupporter.id, ranking.id, nominee2.id);
  check("D4 conviction record created on first support", conv1 !== null && conv1.firstPaymentId === payment.id);
  check("D5 conviction captured pre-payment rank", conv1?.rankAtFirstSupport === (snapshotBefore?.rank ?? null));
  check(
    "D5b conviction captured first amount/currency/visibility",
    conv1?.firstAmountCents === 500 && conv1?.firstCurrency === "gbp" && conv1?.firstVisibility === "private",
    JSON.stringify({ a: conv1?.firstAmountCents, c: conv1?.firstCurrency, v: conv1?.firstVisibility })
  );

  // Webhook redelivery: must not rewrite the first snapshot
  const redelivered = await creditProfileForPayment({
    profileId: nominee2.id, rankingId: ranking.id, supporterUserId: privateSupporter.id,
    paymentId: payment.id, credits: payment.credits, visibility: payment.visibilityChoice,
  });
  check("D6 webhook redelivery grants nothing (idempotent)", redelivered === false);
  const convAfterRedelivery = await getConvictionRecord(privateSupporter.id, ranking.id, nominee2.id);
  check(
    "D7 conviction first snapshot immutable on redelivery",
    convAfterRedelivery?.firstPaymentId === payment.id &&
      convAfterRedelivery?.firstSupportedAt === conv1?.firstSupportedAt
  );

  // Second support by the same user: only last_supported_at advances
  const payment2 = await createPendingPayment({
    userId: privateSupporter.id, rankingId: ranking.id, profileId: nominee2.id,
    packageId: "custom", credits: 100, amountCents: 1000, currency: "gbp",
    visibilityChoice: "public", // changed their mind this time
    stripeCheckoutSessionId: "cs_phase1_gbp_2",
  });
  await markPaymentCompleted(payment2.id, "pi_phase1_gbp_2");
  const snap2 = await getSupportedRankSnapshot(ranking.id, nominee2.id);
  const granted4 = await creditProfileForPayment({
    profileId: nominee2.id, rankingId: ranking.id, supporterUserId: privateSupporter.id,
    paymentId: payment2.id, credits: payment2.credits, visibility: payment2.visibilityChoice,
  });
  if (granted4) {
    await recordConviction({
      userId: payment2.userId, rankingId: payment2.rankingId, profileId: payment2.profileId,
      rankAtSupport: snap2?.rank ?? null, supporterCountAtSupport: snap2?.supporterCount ?? null,
      paymentId: payment2.id,
      amountCents: payment2.amountCents,
      currency: payment2.currency,
      visibility: payment2.visibilityChoice,
    });
  }
  const conv2 = await getConvictionRecord(privateSupporter.id, ranking.id, nominee2.id);
  check(
    "D8 repeat support keeps FIRST snapshot, updates last_supported_at",
    conv2?.firstPaymentId === payment.id &&
      conv2?.rankAtFirstSupport === conv1?.rankAtFirstSupport &&
      conv2?.firstAmountCents === 500 &&
      conv2?.firstCurrency === "gbp" &&
      conv2?.firstVisibility === "private" &&
      (conv2?.lastSupportedAt ?? "") >= (conv1?.lastSupportedAt ?? "")
  );

  // --- E. effectiveVisibility ---
  check("E1 explicit public beats private default", effectiveVisibility("public", "private") === "public");
  check("E2 explicit private beats public default", effectiveVisibility("private", "public") === "private");
  check("E3 null action falls back to user default", effectiveVisibility(null, "private") === "private");
  check("E4 undefined default falls back to public", effectiveVisibility(null, undefined) === "public");
  check("E5 isVisibility guards", isVisibility("public") && isVisibility("private") && !isVisibility("friends"));

  // --- F. Currency plumbing ---
  check("F1 usd|gbp accepted", isSupportCurrency("usd") && isSupportCurrency("gbp"));
  check("F2 eur rejected", !isSupportCurrency("eur") && !isSupportCurrency("USD"));
  check("F3 no-FX unit rate (£1 = 10, $1 = 10)", creditsPerUnit("gbp") === 10 && creditsPerUnit("usd") === 10);
  check("F4 legacy constant intact", CREDITS_PER_DOLLAR === 10 && CREDITS_PER_POUND === 10);

  // --- G. User visibility defaults round-trip ---
  await setUserVisibility(privateLiker.id, { showLikes: "private", showSupports: "private" });
  const vis = await getUserVisibility(privateLiker.id);
  check("G1 set/get visibility round-trip", vis.showLikes === "private" && vis.showSupports === "private");
  const visDefault = await getUserVisibility(publicLiker.id);
  check("G2 defaults are public", visDefault.showLikes === "public" && visDefault.showSupports === "public");

  console.log(failures === 0 ? "\nALL PHASE 1 TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Harness crashed:", err);
  process.exit(1);
});
