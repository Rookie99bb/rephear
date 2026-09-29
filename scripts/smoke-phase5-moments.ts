// Phase 5.1 (Support Story & Backing Journey) smoke test: moment capture
// substrate.
//
// Covers:
//  A. Migrations apply idempotently (ensureMigrated twice; backing_moments
//     + payments.support_reason* columns exist).
//  B. Completed payment → exactly one backing_moments row with correct
//     pre-insert snapshot (rank, total credits, backer count, backer #,
//     growth stage, reason, visibility audit field).
//  C. Webhook redelivery → still one row, snapshot NEVER rewritten
//     (immutability: a re-insert with different values is a no-op).
//  D. Reason flows: preset + custom text + skip all land in payments →
//     backing_moments; invalid preset rejected; text trimmed/capped.
//  E. Private/public parity: a private Support counts fully in ranking
//     SUM/COUNT totals; seed_community_* excluded from backer counts.
//  F. growthStageForRank unit mapping.
//  G. conviction_records writing untouched: first-only semantics still
//     hold alongside moments.
//
// Runs against a throwaway local SQLite file — NEVER production.
// Usage: DATA_DIR=$(mktemp -d /tmp/rephear-p51.XXXXXX) npx tsx scripts/smoke-phase5-moments.ts

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DATA_DIR = fs.mkdtempSync(
  path.join(os.tmpdir(), "smoke-phase5-moments-")
);

let failures = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

async function main() {
  const { ensureMigrated } = await import("@/db/schema");
  const { db } = await import("@/db/client");
  const { newId } = await import("@/lib/id");
  const bcrypt = (await import("bcryptjs")).default;
  const { createUser } = await import("@/db/users");
  const { createRanking } = await import("@/db/rankings");
  const { createProfile } = await import("@/db/profiles");
  const {
    createPendingPayment,
    markPaymentCompleted,
    findPaymentById,
  } = await import("@/db/payments");
  const { creditProfileForPayment } = await import("@/db/creditTransactions");
  const { getSupportedRankSnapshot } = await import("@/db/leaderboards");
  const { recordConviction } = await import("@/db/convictionRecords");
  const { recordBackingMoment, getBackingMoment } = await import(
    "@/db/backingMoments"
  );
  const {
    isSupportReason,
    normalizeSupportReasonText,
    growthStageForRank,
    SUPPORT_REASON_TEXT_MAX,
  } = await import("@/lib/supportReasons");
  const { effectiveVisibility } = await import("@/db/visibility");

  // A. Migration idempotency on a fresh DB.
  await ensureMigrated();
  await ensureMigrated();
  const cols = (await db
    .prepare(`PRAGMA table_info(payments)`)
    .all()) as unknown as { name: string }[];
  const colNames = cols.map((c) => c.name);
  check(
    "payments has support_reason + support_reason_text",
    colNames.includes("support_reason") &&
      colNames.includes("support_reason_text")
  );
  const tables = (await db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='backing_moments'`
    )
    .all()) as unknown as { name: string }[];
  check("backing_moments table exists", tables.length === 1);

  // Fixtures.
  const stamp = Date.now().toString(36);
  const mkUser = (tag: string) =>
    createUser({
      email: `p51-${tag}-${stamp}@example.com`,
      passwordHash: bcrypt.hashSync("password123", 10),
      name: `P51 ${tag}`,
    });
  const alice = await mkUser("alice");
  const betty = await mkUser("betty");
  // Synthetic seed account: must never count as a backer.
  const seedId = `seed_community_smoke_${stamp}`;
  await db
    .prepare(
      `INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`
    )
    .run(seedId, `seed-${stamp}@example.com`, "x", "Seed Community");
  const ranking = await createRanking({
    title: `P51 Ranking ${stamp}`,
    country: "UK",
    city: "London",
    description: "smoke",
    createdBy: alice.id,
  });
  const mia = await createProfile({
    rankingId: ranking.id,
    name: "Mia Smoke",
    addedBy: alice.id,
  });
  const other = await createProfile({
    rankingId: ranking.id,
    name: "Other Smoke",
    addedBy: alice.id,
  });

  // Simulates the webhook completion path for one payment (mirrors
  // src/app/api/stripe/webhook/route.ts: snapshot BEFORE credits land,
  // then credit, then conviction + moment inserts).
  async function completePayment(opts: {
    userId: string;
    profileId: string;
    credits: number;
    visibilityChoice: "public" | "private";
    supportReason?: string | null;
    supportReasonText?: string | null;
  }) {
    const payment = await createPendingPayment({
      userId: opts.userId,
      rankingId: ranking.id,
      profileId: opts.profileId,
      packageId: "smoke-pkg",
      credits: opts.credits,
      amountCents: opts.credits * 10,
      currency: "gbp",
      visibilityChoice: opts.visibilityChoice,
      stripeCheckoutSessionId: `sess_${newId()}`,
      supportReason: opts.supportReason ?? null,
      supportReasonText: opts.supportReasonText ?? null,
    });
    await markPaymentCompleted(payment.id, `pi_${newId()}`);
    const snapshot = await getSupportedRankSnapshot(ranking.id, opts.profileId);
    const granted = await creditProfileForPayment({
      profileId: opts.profileId,
      rankingId: ranking.id,
      supporterUserId: opts.userId,
      paymentId: payment.id,
      credits: opts.credits,
      visibility: opts.visibilityChoice,
    });
    let convictionCreated = false;
    if (granted) {
      const c = await recordConviction({
        userId: opts.userId,
        rankingId: ranking.id,
        profileId: opts.profileId,
        rankAtSupport: snapshot?.rank ?? null,
        supporterCountAtSupport: snapshot?.supporterCount ?? null,
        paymentId: payment.id,
        amountCents: payment.amountCents,
        currency: payment.currency,
        visibility: payment.visibilityChoice,
      });
      convictionCreated = c.created;
      await recordBackingMoment({
        userId: opts.userId,
        rankingId: ranking.id,
        profileId: opts.profileId,
        paymentId: payment.id,
        credits: opts.credits,
        rankAtSupport: snapshot?.rank ?? null,
        totalCreditsAtSupport: snapshot?.totalCredits ?? null,
        backerCountAtSupport: snapshot?.supporterCount ?? null,
        supportReason: payment.supportReason,
        supportReasonText: payment.supportReasonText,
        visibilityAtSupport: effectiveVisibility(
          payment.visibilityChoice,
          "public"
        ),
      });
    }
    return { payment, snapshot, granted, convictionCreated };
  }

  // B. First payment: Betty backs Mia (private, preset reason).
  // Pre-insert state: Mia rank #1 (tied 0 credits, earliest added wins —
  // both 0, Mia was added first), 0 credits, 0 backers.
  const first = await completePayment({
    userId: betty.id,
    profileId: mia.id,
    credits: 50,
    visibilityChoice: "private",
    supportReason: "believe_potential",
  });
  check("first payment granted credits", first.granted === true);
  const m1 = await getBackingMoment(first.payment.id);
  check("exactly one moment row created", m1 !== null);
  check(
    "moment snapshot is pre-insert (rank 1, 0 credits, 0 backers)",
    m1?.rankAtSupport === 1 &&
      m1?.totalCreditsAtSupport === 0 &&
      m1?.backerCountAtSupport === 0,
    JSON.stringify({
      rank: m1?.rankAtSupport,
      credits: m1?.totalCreditsAtSupport,
      backers: m1?.backerCountAtSupport,
    })
  );
  check("backer_number = backer_count + 1", m1?.backerNumber === 1);
  check("growth stage number_1 for rank 1", m1?.growthStageAtSupport === "number_1");
  check("preset reason stored", m1?.supportReason === "believe_potential");
  check("no custom text when preset used", m1?.supportReasonText === null);
  check(
    "visibility_at_support audit = private",
    m1?.visibilityAtSupport === "private"
  );
  check("moment credits = 50", m1?.credits === 50);

  // C. Redelivery: same payment, different snapshot values → no-op.
  const re = await recordBackingMoment({
    userId: betty.id,
    rankingId: ranking.id,
    profileId: mia.id,
    paymentId: first.payment.id,
    credits: 50,
    rankAtSupport: 99,
    totalCreditsAtSupport: 999999,
    backerCountAtSupport: 999,
    supportReason: "deserves_recognition",
    supportReasonText: "tampered",
    visibilityAtSupport: "public",
  });
  const m1b = await getBackingMoment(first.payment.id);
  check("redelivery does not create a second row", re.created === false);
  check(
    "snapshot immutable under redelivery",
    m1b?.rankAtSupport === 1 &&
      m1b?.totalCreditsAtSupport === 0 &&
      m1b?.backerNumber === 1 &&
      m1b?.supportReason === "believe_potential" &&
      m1b?.supportReasonText === null &&
      m1b?.visibilityAtSupport === "private"
  );

  // D. Second payment: Alice backs Mia with custom reason text.
  // Pre-insert: Mia rank 1, 50 credits, 1 backer → backer #2.
  const longText = `  I watched her first gig ${"x".repeat(500)}  `;
  const second = await completePayment({
    userId: alice.id,
    profileId: mia.id,
    credits: 100,
    visibilityChoice: "public",
    supportReason: "custom",
    supportReasonText: longText,
  });
  const m2 = await getBackingMoment(second.payment.id);
  check(
    "second moment sees first payment's credits/backer",
    m2?.totalCreditsAtSupport === 50 && m2?.backerCountAtSupport === 1,
    JSON.stringify({
      credits: m2?.totalCreditsAtSupport,
      backers: m2?.backerCountAtSupport,
    })
  );
  check("backer #2", m2?.backerNumber === 2);
  check("custom reason key stored", m2?.supportReason === "custom");
  const m2Text = m2?.supportReasonText;
  check(
    "custom text trimmed + capped at 280",
    typeof m2Text === "string" &&
      m2Text.length <= SUPPORT_REASON_TEXT_MAX &&
      m2Text.startsWith("I watched her first gig") &&
      !m2Text.endsWith(" "),
    `len=${m2Text?.length}`
  );

  // D2. Skip: no reason at all → nulls.
  const third = await completePayment({
    userId: alice.id,
    profileId: other.id,
    credits: 10,
    visibilityChoice: "public",
  });
  const m3 = await getBackingMoment(third.payment.id);
  check(
    "skipped reason → nulls",
    m3?.supportReason === null && m3?.supportReasonText === null
  );

  // D3. Reason validation.
  check("isSupportReason accepts presets", isSupportReason("believe_potential"));
  check("isSupportReason accepts custom", isSupportReason("custom"));
  check("isSupportReason rejects garbage", !isSupportReason("whale_spender"));
  check("isSupportReason rejects empty", !isSupportReason(""));
  check(
    "normalizeSupportReasonText trims + caps",
    normalizeSupportReasonText("  hi  ") === "hi" &&
      (normalizeSupportReasonText("y".repeat(500))?.length ?? 0) ===
        SUPPORT_REASON_TEXT_MAX &&
      normalizeSupportReasonText("   ") === null &&
      normalizeSupportReasonText(undefined) === null
  );

  // E. Private/public parity + seed exclusion.
  // Seed account "supports" Mia with 1000 credits — must not count as a
  // backer, but its credits DO count in totals (aggregates never filter
  // identity; seed exclusion is identity-only, matching the existing
  // getSupportedRankSnapshot semantics).
  const seedPay = await createPendingPayment({
    userId: seedId,
    rankingId: ranking.id,
    profileId: mia.id,
    packageId: "smoke-pkg",
    credits: 1000,
    amountCents: 10000,
    currency: "usd",
    visibilityChoice: "public",
    stripeCheckoutSessionId: `sess_${newId()}`,
  });
  await markPaymentCompleted(seedPay.id, `pi_${newId()}`);
  await creditProfileForPayment({
    profileId: mia.id,
    rankingId: ranking.id,
    supporterUserId: seedId,
    paymentId: seedPay.id,
    credits: 1000,
    visibility: "public",
  });
  const afterSeed = await getSupportedRankSnapshot(ranking.id, mia.id);
  check(
    "seed credits count in totals (50+100+1000)",
    afterSeed?.totalCredits === 1150,
    `got ${afterSeed?.totalCredits}`
  );
  check(
    "seed account excluded from backer count (still 2)",
    afterSeed?.supporterCount === 2,
    `got ${afterSeed?.supporterCount}`
  );
  // Private support (Betty's 50) counted fully in totals.
  check(
    "private support counts fully in ranking totals",
    (afterSeed?.totalCredits ?? 0) >= 50
  );

  // F. Growth-stage mapping.
  const stageCases: [number | null, string][] = [
    [null, "unranked"],
    [1, "number_1"],
    [2, "top_3"],
    [3, "top_3"],
    [4, "top_10"],
    [10, "top_10"],
    [11, "top_20"],
    [20, "top_20"],
    [21, "top_50"],
    [50, "top_50"],
    [51, "outside_top_50"],
    [500, "outside_top_50"],
  ];
  const stageOk = stageCases.every(
    ([rank, want]) => growthStageForRank(rank) === want
  );
  check("growthStageForRank mapping", stageOk);

  // G. conviction_records untouched: first-only semantics hold.
  const convBetty = await recordConviction({
    userId: betty.id,
    rankingId: ranking.id,
    profileId: mia.id,
    rankAtSupport: 1,
    supporterCountAtSupport: 0,
    paymentId: second.payment.id,
    amountCents: 1000,
    currency: "gbp",
    visibility: "public",
  });
  check(
    "conviction repeat support only bumps last_supported_at",
    convBetty.created === false &&
      convBetty.record.firstPaymentId === first.payment.id
  );

  // Payments row carries reason through.
  const p2 = await findPaymentById(second.payment.id);
  check(
    "payments row stores reason + text",
    p2?.supportReason === "custom" &&
      p2?.supportReasonText === m2?.supportReasonText
  );

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll Phase 5.1 smoke checks passed.");
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
