// Phase 2 (public identity) smoke test: /u/[id] profile reads,
// supporter-list privacy, Taste Match gating (incl. the no-oracle
// property), and the report/block/hide moderation flow.
//
// Covers (brief §6):
//  1. Public vs private actions: ranking totals include both; supporter
//     names contain only effective-public; total reconciles.
//  2. A fully-private user's data never surfaces to another viewer
//     (lists empty, counts zero, no activity) — the exact rows the
//     /u/[id] page renders.
//  3. Taste Match: ≥3-shared gate, private-flip exclusion, seed never
//     matched, no public API oracle (server-only module).
//  4. Report → hide: hidden profile vanishes from supporter totals and
//     taste-match sets; unhide restores.
//  5. Block: mutual invisibility on profile/taste-match/supporter
//     names; global totals unchanged.
//  6. Migration idempotency: user_reports, user_blocks, users.is_hidden.
//  7. Conviction first-wins visibility (getConvictionVisibility).
//
// Runs against a throwaway local SQLite file — NEVER production.
// Usage: DATA_DIR=$(mktemp -d /tmp/rephear-phase2-test.XXXXXX) npx tsx scripts/smoke-phase2-identity.ts

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DATA_DIR = fs.mkdtempSync(
  path.join(os.tmpdir(), "smoke-phase2-identity-")
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
  const { createUser, setUserVisibility } = await import("@/db/users");
  const { createRanking } = await import("@/db/rankings");
  const { createProfile } = await import("@/db/profiles");
  const { createCategory } = await import("@/db/categories");
  const { addLike } = await import("@/db/likes");
  const { likedPublicItemsForUser, likedItemsForUser } = await import(
    "@/db/likes"
  );
  const {
    createPendingPayment,
    markPaymentCompleted,
  } = await import("@/db/payments");
  const { creditProfileForPayment } = await import("@/db/creditTransactions");
  const { recordConviction } = await import("@/db/convictionRecords");
  const { getConvictionVisibility } = await import("@/db/visibility");
  const { getMostSupported, getMostLoved } = await import(
    "@/db/leaderboards"
  );
  const { getSupporterList } = await import("@/db/supporters");
  const {
    getInterestTags,
    getIdentityStats,
    getPeopleIBack,
    getTasteMatch,
    hasPublicActivity,
  } = await import("@/db/publicProfiles");
  const {
    createReport,
    listPendingReports,
    setReportStatus,
    blockUser,
    unblockUser,
    isBlockedEither,
    setUserHidden,
    countRecentReportsByReporter,
  } = await import("@/db/userReports");

  // 6. Migrations apply idempotently on a fresh DB.
  await ensureMigrated();
  await ensureMigrated();
  const userCols = (
    (await db.prepare(`PRAGMA table_info(users)`).all()) as unknown as {
      name: string;
    }[]
  ).map((c) => c.name);
  check("users.is_hidden column exists", userCols.includes("is_hidden"));
  const tables = (
    (await db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('user_reports','user_blocks')`
      )
      .all()) as unknown as { name: string }[]
  ).map((t) => t.name);
  check(
    "user_reports + user_blocks tables exist",
    tables.includes("user_reports") && tables.includes("user_blocks")
  );

  // Fixtures.
  const stamp = Date.now().toString(36);
  const mkUser = (tag: string) =>
    createUser({
      email: `p2-${tag}-${stamp}@example.com`,
      passwordHash: bcrypt.hashSync("password123", 10),
      name: `P2 ${tag}`,
    });
  const alice = await mkUser("alice"); // public defaults
  const betty = await mkUser("betty"); // fully private
  const cara = await mkUser("cara"); // public
  await setUserVisibility(betty.id, {
    showLikes: "private",
    showSupports: "private",
  });
  // Synthetic seed account: must never surface in identity queries.
  const seedId = `seed_community_smoke_${stamp}`;
  await db
    .prepare(
      `INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`
    )
    .run(seedId, `seed-${stamp}@example.com`, "x", "Seed Community");

  const category = await createCategory({
    name: `Smoke Cat ${stamp}`,
    slug: `smoke-cat-${stamp}`,
    description: "smoke",
  });
  const ranking = await createRanking({
    title: `P2 Ranking ${stamp}`,
    country: "UK",
    city: "London",
    description: "smoke",
    createdBy: alice.id,
    categoryId: category.id,
  });
  const x = await createProfile({
    rankingId: ranking.id,
    name: "X Smoke",
    addedBy: alice.id,
  });
  const y = await createProfile({
    rankingId: ranking.id,
    name: "Y Smoke",
    addedBy: alice.id,
  });
  const z = await createProfile({
    rankingId: ranking.id,
    name: "Z Smoke",
    addedBy: alice.id,
  });

  // Simulates the webhook completion path for one payment (mirrors
  // src/app/api/stripe/webhook/route.ts).
  async function completeSupport(opts: {
    userId: string;
    profileId: string;
    credits: number;
    visibilityChoice: "public" | "private";
    creditVisibility?: "public" | "private" | null; // null = inherit (NULL row)
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
    });
    await markPaymentCompleted(payment.id, `pi_${newId()}`);
    const granted = await creditProfileForPayment({
      profileId: opts.profileId,
      rankingId: ranking.id,
      supporterUserId: opts.userId,
      paymentId: payment.id,
      credits: opts.credits,
      visibility: opts.creditVisibility ?? null,
    });
    if (!granted) throw new Error("credit grant failed");
    await recordConviction({
      userId: opts.userId,
      rankingId: ranking.id,
      profileId: opts.profileId,
      rankAtSupport: 5,
      supporterCountAtSupport: 0,
      paymentId: payment.id,
      amountCents: opts.credits * 10,
      currency: "gbp",
      visibility: opts.visibilityChoice,
    });
    return payment;
  }

  // A likes + supports X publicly; B likes (inherits private) + supports
  // X privately (credit row NULL → inherits show_supports = private).
  await addLike({ rankingId: ranking.id, profileId: x.id, userId: alice.id });
  await addLike({ rankingId: ranking.id, profileId: x.id, userId: betty.id });
  await completeSupport({
    userId: alice.id,
    profileId: x.id,
    credits: 50,
    visibilityChoice: "public",
    creditVisibility: "public",
  });
  await completeSupport({
    userId: betty.id,
    profileId: x.id,
    credits: 50,
    visibilityChoice: "private",
    creditVisibility: null, // inherit → private
  });
  // Seed account supports X publicly: must never count or surface.
  await completeSupport({
    userId: seedId,
    profileId: x.id,
    credits: 50,
    visibilityChoice: "public",
    creditVisibility: "public",
  });

  // 1. Ranking-total purity: private actions count fully. Note: the seed
  //    account's credits land in the board SUM — this is pre-existing
  //    Phase 1 behaviour (seed is excluded from backer *counts* and from
  //    every identity-adjacent query, but not from the raw board SUM).
  //    Phase 2 does not touch leaderboard reads.
  const supported = await getMostSupported(ranking.id);
  const xRow = supported.find((e) => e.profile.id === x.id)!;
  check(
    "Most Supported total includes private support (150 credits incl. seed)",
    xRow.reputationCredits === 150,
    `got ${xRow.reputationCredits}`
  );
  const loved = await getMostLoved(ranking.id);
  const xLoved = loved.find((e) => e.profile.id === x.id)!;
  check(
    "Most Loved total includes private like (2)",
    xLoved.likeCount === 2,
    `got ${xLoved.likeCount}`
  );

  const list = await getSupporterList(x.id, null, 10);
  check(
    "supporter total counts private supporter (2, seed excluded)",
    list.totalSupporters === 2,
    `got ${list.totalSupporters}`
  );
  check(
    "supporter names contain Alice, not Betty, not seed",
    list.supporters.length === 1 && list.supporters[0].userId === alice.id,
    JSON.stringify(list.supporters)
  );
  check(
    "public names + others == total",
    list.supporters.length + list.othersCount === list.totalSupporters
  );
  check(
    "supporter payload contains no 'private' string",
    !JSON.stringify(list).includes("private")
  );
  // Route contract lint: the API response body must never be able to
  // carry the word "private" — the JSON-string assertion above checks
  // the payload; here we make sure the route never embeds it in a
  // response string (comments may quote the word, double quotes may not).
  const routeSrc = fs.readFileSync(
    "src/app/api/profiles/[profileId]/supporters/route.ts",
    "utf8"
  );
  check(
    'supporters route source has no "private" JSON string',
    !routeSrc.includes('"private"')
  );

  // 7. Conviction first-wins visibility.
  const crRows = (await db
    .prepare(`SELECT id, user_id FROM conviction_records`)
    .all()) as unknown as { id: string; user_id: string }[];
  const aliceCr = crRows.find((r) => r.user_id === alice.id)!;
  const bettyCr = crRows.find((r) => r.user_id === betty.id)!;
  check(
    "getConvictionVisibility: Alice public",
    (await getConvictionVisibility(aliceCr.id)) === "public"
  );
  check(
    "getConvictionVisibility: Betty private (first-wins)",
    (await getConvictionVisibility(bettyCr.id)) === "private"
  );

  // 2. Betty's profile as seen by Alice: nothing attributable.
  const bettyAsSeenByAlice = await getPeopleIBack(alice.id, betty.id);
  check(
    "private backing invisible to another viewer",
    bettyAsSeenByAlice.length === 0
  );
  const bettyLikesPublic = await likedPublicItemsForUser(betty.id);
  check("private likes invisible to another viewer", bettyLikesPublic.length === 0);
  const bettyStats = await getIdentityStats(betty.id, false);
  check(
    "private user shows zero public stats",
    bettyStats.backedCreators === 0 &&
      bettyStats.earlyBacker === 0 &&
      bettyStats.reachedTop10 === 0,
    JSON.stringify(bettyStats)
  );
  check(
    "hasPublicActivity false for fully-private user",
    (await hasPublicActivity(betty.id)) === false
  );
  check(
    "no interest tags from private activity",
    (await getInterestTags(betty.id, false)).length === 0
  );
  // Owner sees everything, with visibility flags.
  const bettyOwn = await getPeopleIBack(betty.id, betty.id);
  check(
    "owner sees own private backing (isPublic=false)",
    bettyOwn.length === 1 && bettyOwn[0].isPublic === false
  );
  check(
    "owner sees own likes",
    (await likedItemsForUser(betty.id)).length === 1
  );
  // Alice's public activity surfaces normally.
  check(
    "hasPublicActivity true for public user",
    (await hasPublicActivity(alice.id)) === true
  );
  const aliceTags = await getInterestTags(alice.id, false);
  check(
    "interest tags derive from public activity",
    aliceTags.length === 1 && aliceTags[0].slug === category.slug,
    JSON.stringify(aliceTags)
  );
  const aliceStats = await getIdentityStats(alice.id, false);
  check(
    "Alice backed 1 creator",
    aliceStats.backedCreators === 1,
    JSON.stringify(aliceStats)
  );

  // 3. Taste Match gating.
  // Alice: {X(like,public), X(backing,public)} = {X}; Cara: {} initially.
  await addLike({ rankingId: ranking.id, profileId: x.id, userId: cara.id });
  await addLike({ rankingId: ranking.id, profileId: y.id, userId: cara.id });
  await addLike({ rankingId: ranking.id, profileId: y.id, userId: alice.id });
  // shared(Alice,Cara) = {X, Y} = 2 → no panel.
  check(
    "taste match null below 3 shared",
    (await getTasteMatch(alice.id, cara.id)) === null
  );
  await addLike({ rankingId: ranking.id, profileId: z.id, userId: alice.id });
  await addLike({ rankingId: ranking.id, profileId: z.id, userId: cara.id });
  // shared = {X, Y, Z} = 3; |Alice| = 3, |Cara| = 3 → 100%.
  const tm = await getTasteMatch(alice.id, cara.id);
  check("taste match renders at 3 shared", tm !== null);
  check(
    "taste match score sane (100%)",
    tm !== null && tm.scorePct === 100 && tm.sharedCount === 3,
    JSON.stringify(tm)
  );
  check(
    "taste match lists 3 shared nominees",
    tm !== null && tm.sharedNominees.length === 3
  );
  // Seed account with 3 shared public likes → never matched.
  await addLike({ rankingId: ranking.id, profileId: x.id, userId: seedId });
  await addLike({ rankingId: ranking.id, profileId: y.id, userId: seedId });
  await addLike({ rankingId: ranking.id, profileId: z.id, userId: seedId });
  check(
    "seed account never taste-matched",
    (await getTasteMatch(alice.id, seedId)) === null
  );
  // 5a. Block BEFORE the private-flip, so the panel is live.
  await blockUser(alice.id, cara.id);
  check("isBlockedEither after block", await isBlockedEither(alice.id, cara.id));
  check(
    "taste match null when blocked either direction",
    (await getTasteMatch(alice.id, cara.id)) === null &&
      (await getTasteMatch(cara.id, alice.id)) === null
  );
  // Supporter-list block-awareness: Cara supports Y publicly; Alice (as
  // viewer) must not see her name, but the total is unchanged.
  await completeSupport({
    userId: cara.id,
    profileId: y.id,
    credits: 50,
    visibilityChoice: "public",
    creditVisibility: "public",
  });
  const yListAnon = await getSupporterList(y.id, null, 10);
  const yListAlice = await getSupporterList(y.id, alice.id, 10);
  check(
    "blocked user hidden from names for blocking viewer",
    yListAnon.supporters.some((s) => s.userId === cara.id) &&
      !yListAlice.supporters.some((s) => s.userId === cara.id)
  );
  check(
    "block does not change global supporter total",
    yListAnon.totalSupporters === yListAlice.totalSupporters &&
      yListAnon.totalSupporters === 1,
    `anon=${yListAnon.totalSupporters} alice=${yListAlice.totalSupporters}`
  );
  await unblockUser(alice.id, cara.id);
  check(
    "isBlockedEither false after unblock",
    !(await isBlockedEither(alice.id, cara.id))
  );
  check(
    "taste match restored after unblock",
    (await getTasteMatch(alice.id, cara.id)) !== null
  );
  // 3 continued: flipping Alice's like on Z to private drops the shared
  // set to 2 → panel disappears. Private rows excluded BEFORE
  // computation (invariant 3).
  await db
    .prepare(`UPDATE likes SET visibility = 'private' WHERE user_id = ? AND profile_id = ?`)
    .run(alice.id, z.id);
  check(
    "taste match null after private flip (shared < 3)",
    (await getTasteMatch(alice.id, cara.id)) === null
  );

  // 4. Report → hide → unhide.
  await createReport({
    reporterUserId: alice.id,
    targetUserId: betty.id,
    reason: "smoke test report",
  });
  const pending = await listPendingReports();
  check(
    "report lands in admin queue",
    pending.some(
      (r) => r.reporterUserId === alice.id && r.targetUserId === betty.id
    )
  );
  check(
    "reporter within daily cap",
    (await countRecentReportsByReporter(alice.id)) === 1
  );
  const reportId = pending.find(
    (r) => r.reporterUserId === alice.id && r.targetUserId === betty.id
  )!.id;
  await setReportStatus(reportId, "reviewed");
  check(
    "dismissed report leaves queue",
    (await listPendingReports()).every((r) => r.id !== reportId)
  );
  await setUserHidden(betty.id, true);
  const { findUserById } = await import("@/db/users");
  check(
    "hidden flag set",
    (await findUserById(betty.id))?.isHidden === true
  );
  const listAfterHide = await getSupporterList(x.id, null, 10);
  check(
    "hidden user purged from supporter total",
    listAfterHide.totalSupporters === 1,
    `got ${listAfterHide.totalSupporters}`
  );
  check(
    "hidden user purged from taste-match sets",
    (await getTasteMatch(alice.id, betty.id)) === null
  );
  await setUserHidden(betty.id, false);
  check(
    "unhide restores flag",
    (await findUserById(betty.id))?.isHidden === false
  );
  const listAfterUnhide = await getSupporterList(x.id, null, 10);
  check(
    "unhide restores supporter total",
    listAfterUnhide.totalSupporters === 2,
    `got ${listAfterUnhide.totalSupporters}`
  );

  // 5b. Block idempotency.
  await blockUser(alice.id, cara.id);
  await blockUser(alice.id, cara.id);
  const blockCount = (
    (await db
      .prepare(
        `SELECT COUNT(*) AS n FROM user_blocks WHERE blocker_user_id = ? AND blocked_user_id = ?`
      )
      .get(alice.id, cara.id)) as unknown as { n: number }
  ).n;
  check("block is idempotent (one row)", blockCount === 1);
  await unblockUser(alice.id, cara.id);

  console.log(failures === 0 ? "\nAll Phase 2 checks passed." : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("smoke-phase2-identity crashed:", err);
  process.exit(1);
});
