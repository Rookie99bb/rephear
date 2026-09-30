// Phase 3 (milestones & recognition) smoke test.
//
// Covers (brief §6 / §7 / §14 / §16 / §19 / §22 / §23 / §26):
//  1. Migrations apply idempotently (ensureMigrated twice; new tables
//     and users.notify_milestones exist).
//  2. Threshold detection: a nominee climbing into the Top 50 records
//     exactly one event per threshold (nominated, first_1k_credits,
//     entered_top_50) — never duplicates on re-run.
//  3. Early Backer awards are WHEN-based: awarded iff the first backing
//     moment's rank_at_support was worse than the threshold (or
//     unranked) — never by amount. Seed accounts excluded.
//  4. Notification prefs respected (opt-out user gets nothing).
//  5. Rate cap: max 5 notifications/day; the 6th is dropped.
//  6. Private-backer self-notification: a private backer IS notified
//     about their own backing; nobody else's notification references
//     them.
//  7. Seed exclusion: seed moments produce no awards, no notifications,
//     and don't inflate the public backer count.
//  8. Movement arrows from ranking_snapshots: up/down/new only with two
//     snapshots; nothing with one.
//  9. Follows: follow/unfollow round-trip, invalid target types and
//     missing targets rejected.
// 10. Discovery queries return real data (new rankings, underrated
//     nominees) and never fabricate.
//
// Runs against a throwaway local SQLite file — NEVER production.
// Usage: DATA_DIR=$(mktemp -d /tmp/rephear-phase3-test.XXXXXX) npx tsx scripts/smoke-phase3-milestones.ts

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DATA_DIR = fs.mkdtempSync(
  path.join(os.tmpdir(), "smoke-phase3-milestones-")
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
  const { creditProfileForPayment } = await import(
    "@/db/creditTransactions"
  );
  const { createPendingPayment, markPaymentCompleted } = await import(
    "@/db/payments"
  );
  // Mirror the real checkout flow: pending payment → completed → credits
  // granted (credit_transactions.payment_id is an FK to payments).
  async function pay(opts: {
    userId: string;
    profileId: string;
    credits: number;
    visibilityChoice?: "public" | "private";
  }) {
    const payment = await createPendingPayment({
      userId: opts.userId,
      rankingId: ranking.id,
      profileId: opts.profileId,
      packageId: "smoke-pkg",
      credits: opts.credits,
      amountCents: opts.credits * 10,
      currency: "gbp",
      visibilityChoice: opts.visibilityChoice ?? "public",
      stripeCheckoutSessionId: `sess_${newId()}`,
    });
    await markPaymentCompleted(payment.id, `pi_${newId()}`);
    const granted = await creditProfileForPayment({
      profileId: opts.profileId,
      rankingId: ranking.id,
      supporterUserId: opts.userId,
      paymentId: payment.id,
      credits: opts.credits,
      visibility: opts.visibilityChoice ?? null,
    });
    if (!granted) throw new Error("credit grant failed");
    return payment.id;
  }
  const { recordBackingMoment } = await import("@/db/backingMoments");
  const { addLike } = await import("@/db/likes");
  const {
    getMilestoneEvents,
    hasMilestoneEvent,
    getSupportedBoardState,
    getEarlyBackerAwards,
    hasEarlyBackerAward,
  } = await import("@/db/milestones");
  const {
    createNotification,
    listNotifications: getNotifications,
    countUnreadNotifications: getUnreadCount,
    getNotifyMilestonesPref,
    setNotifyMilestonesPref,
  } = await import("@/db/notifications");
  const {
    follow,
    unfollow,
    isFollowing,
    listFollows,
    countFollowers,
  } = await import("@/db/follows");
  const { writeRankingSnapshot, getMovement } = await import(
    "@/db/rankingSnapshots"
  );
  const { getNewRankings, getUnderratedNominees } = await import(
    "@/db/discovery"
  );
  const { runMilestoneDetection } = await import("@/lib/milestoneRunner");

  // ── 1. Migrations are idempotent ──────────────────────────────
  await ensureMigrated();
  await ensureMigrated();
  const tables = (await db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name IN
       ('milestone_events','early_backer_awards','notifications',
        'ranking_snapshots','follows')`
    )
    .all()) as { name: string }[];
  check("phase3 tables exist", tables.length === 5, `got ${tables.length}`);
  const userCols = (await db
    .prepare(`PRAGMA table_info(users)`)
    .all()) as { name: string }[];
  check(
    "users.notify_milestones column exists",
    userCols.some((c) => c.name === "notify_milestones")
  );
  const uniq = (await db
    .prepare(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='milestone_events'`
    )
    .get()) as { sql: string };
  check(
    "milestone_events has the (ranking, profile, type) uniqueness guard",
    /UNIQUE\s*\(\s*ranking_id\s*,\s*profile_id\s*,\s*type\s*\)/i.test(uniq.sql)
  );

  // ── Fixtures ──────────────────────────────────────────────────
  const pw = await bcrypt.hash("password123", 10);
  const mkUser = (email: string, name: string) =>
    createUser({ email, passwordHash: pw, name });
  const userA = await mkUser("phase3a@example.com", "Early Alice"); // backed at #55, 10 credits
  const userB = await mkUser("phase3b@example.com", "Late Bob"); // backed at #30, 1000 credits (whale, but late)
  const userC = await mkUser("phase3c@example.com", "Private Cara"); // private, backed at #60
  const userD = await mkUser("phase3d@example.com", "Optout Dan"); // backed at #70, pref OFF
  const userE = await mkUser("phase3e@example.com", "Cap Erin"); // rate-cap probe
  const userF = await mkUser("phase3f@example.com", "Follower Fay"); // ranking follower
  const filler = await mkUser("phase3g@example.com", "Filler Gus");
  // Seed account: id must match the seed_community_* pattern.
  const seedId = "seed_community_test1";
  await db
    .prepare(
      `INSERT INTO users (id, email, password_hash, name, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    )
    .run(seedId, "seed@example.com", pw, "Seed Sam");

  const ranking = await createRanking({
    title: "Phase 3 Test Ranking",
    country: "UK",
    city: "London",
    description: "smoke test",
    createdBy: userA.id,
  });

  // The climber: 25 profiles, P1 lands at rank #25 with 1,510 credits
  // (≥ 1,000 → first_1k_credits fires; ≤ 50 → entered_top_50 fires).
  const climber = await createProfile({
    rankingId: ranking.id,
    name: "Clara Climber",
    addedBy: userA.id,
  });
  const others: { id: string }[] = [];
  for (let i = 0; i < 24; i++) {
    others.push(
      await createProfile({
        rankingId: ranking.id,
        name: `Filler Nominee ${i}`,
        addedBy: filler.id,
      })
    );
  }
  const moment = (
    paymentId: string,
    userId: string,
    rankAtSupport: number | null,
    credits: number,
    visibility: "public" | "private"
  ) =>
    recordBackingMoment({
      userId,
      rankingId: ranking.id,
      profileId: climber.id,
      paymentId,
      credits,
      rankAtSupport,
      totalCreditsAtSupport: 100,
      backerCountAtSupport: 1,
      supportReason: null,
      supportReasonText: null,
      visibilityAtSupport: visibility,
    });
  const payA = await pay({ userId: userA.id, profileId: climber.id, credits: 10 });
  const payB = await pay({ userId: userB.id, profileId: climber.id, credits: 1000 });
  const payC = await pay({ userId: userC.id, profileId: climber.id, credits: 300, visibilityChoice: "private" });
  const payD = await pay({ userId: userD.id, profileId: climber.id, credits: 100 });
  const payS = await pay({ userId: seedId, profileId: climber.id, credits: 100 });
  await moment(payA, userA.id, 55, 10, "public");
  await moment(payB, userB.id, 30, 1000, "public");
  await moment(payC, userC.id, 60, 300, "private");
  await moment(payD, userD.id, 70, 100, "public");
  await moment(payS, seedId, 65, 100, "public");
  for (const o of others) {
    await pay({ userId: filler.id, profileId: o.id, credits: 2000 });
  }

  await setNotifyMilestonesPref(userD.id, false);
  await follow(userF.id, "ranking", ranking.id);

  // ── 2/3. Detection + awards ───────────────────────────────────
  const stats1 = await runMilestoneDetection();
  check("cron scanned the ranking", stats1.rankings >= 1);
  check("cron reported no errors", stats1.errors === 0);

  const climberEvents = await getMilestoneEvents(ranking.id, climber.id);
  const types = new Set(climberEvents.map((e) => e.type));
  check("climber recorded nominated", types.has("nominated"));
  check("climber recorded first_1k_credits", types.has("first_1k_credits"));
  check("climber recorded entered_top_50", types.has("entered_top_50"));
  check(
    "climber recorded exactly 3 events (no entered_top_20/10 at #25)",
    climberEvents.length === 3,
    `got ${climberEvents.map((e) => e.type).join(",")}`
  );
  check(
    "hasMilestoneEvent agrees",
    await hasMilestoneEvent(ranking.id, climber.id, "entered_top_50")
  );

  // WHEN, not HOW MUCH: Alice (10 credits, backed at #55) is awarded;
  // Bob (1,000 credits, backed at #30 — after the top-50 crossing) is not.
  check(
    "early backer awarded to Alice (backed at #55, before the climb)",
    await hasEarlyBackerAward(userA.id, ranking.id, climber.id, "entered_top_50")
  );
  check(
    "no early-backer award for Bob despite 1,000 credits (backed at #30, after)",
    !(await hasEarlyBackerAward(userB.id, ranking.id, climber.id, "entered_top_50"))
  );
  check(
    "private backer Cara still qualifies (privacy is control, not status)",
    await hasEarlyBackerAward(userC.id, ranking.id, climber.id, "entered_top_50")
  );
  check(
    "no award row for the seed account",
    (await getEarlyBackerAwards(seedId)).length === 0
  );
  check(
    "opt-out Dan is awarded (award is a fact) even though he gets no notification",
    await hasEarlyBackerAward(userD.id, ranking.id, climber.id, "entered_top_50")
  );

  // Seed credits must not inflate the public backer count.
  const board = await getSupportedBoardState(ranking.id);
  const climberRow = board.find((b) => b.profileId === climber.id)!;
  check("climber sits at rank #25", climberRow.rank === 25, `got #${climberRow.rank}`);
  check(
    "backer count excludes the seed supporter (4, not 5)",
    climberRow.backerCount === 4,
    `got ${climberRow.backerCount}`
  );

  // ── 4/5/6. Notifications: prefs, cap, private self-notify ─────
  const notesA = await getNotifications(userA.id, 50);
  // 5.5: award recipients get ONE story notification per event — the
  // early-backer story (6a) replaces the generic 6b ping for the same
  // event. Alice: early_backer (entered_top_50) + backed_nominee
  // (first_1k_credits) = 2.
  check("Alice got 2 notifications (early_backer story + 1 backed_nominee)", notesA.length === 2, `got ${notesA.length}`);
  const aliceEarly = notesA.find((n) => n.type === "early_backer_milestone");
  check(
    "Alice's early-backer notification is story-framed with real ranks",
    !!aliceEarly &&
      /you were there early/i.test(aliceEarly.title) &&
      aliceEarly.body.includes("at #55") &&
      aliceEarly.body.includes("now #25"),
    aliceEarly ? `${aliceEarly.title} / ${aliceEarly.body}` : "missing"
  );
  check(
    "Alice got no duplicate backed_nominee for the awarded event (5.5 dedupe)",
    notesA.filter((n) => n.type === "backed_nominee_milestone").length === 1
  );
  const aliceStory = notesA.find((n) => n.type === "backed_nominee_milestone");
  check(
    "Alice's credits-milestone story is credits-only with THEN→NOW",
    !!aliceStory &&
      /1,000 Support Credits/.test(aliceStory.title) &&
      aliceStory.body.includes("at #55") &&
      !/before the climb/i.test(aliceStory.body),
    aliceStory ? `${aliceStory.title} / ${aliceStory.body}` : "missing"
  );
  check(
    "notification copy never references the backer's own spend or pressures re-support",
    notesA.every((n) => !/spent|spend|support again/i.test(n.title + n.body)),
    JSON.stringify(notesA.map((n) => n.title + " / " + n.body))
  );
  const notesB = await getNotifications(userB.id, 50);
  check("Bob got 2 backed_nominee self-notifications", notesB.length === 2, `got ${notesB.length}`);
  check(
    "Bob got no early_backer notification",
    notesB.every((n) => n.type !== "early_backer_milestone")
  );
  const notesC = await getNotifications(userC.id, 50);
  check(
    "private backer Cara IS notified about her own backing (self-notify is not exposure): early_backer story + 1 backed_nominee",
    notesC.length === 2,
    `got ${notesC.length}`
  );
  check(
    "nobody else's notification references Cara",
    (await getNotifications(userA.id, 50))
      .concat(await getNotifications(userB.id, 50))
      .concat(await getNotifications(userF.id, 50))
      .every((n) => !/Private Cara|phase3c@/i.test(n.title + n.body))
  );
  check(
    "opt-out Dan got zero notifications",
    (await getNotifications(userD.id, 50)).length === 0
  );
  check("seed account got zero notifications", (await getNotifications(seedId, 50)).length === 0);
  const notesF = await getNotifications(userF.id, 50);
  check(
    "follower Fay got only follow_update notifications",
    notesF.length > 0 && notesF.every((n) => n.type === "follow_update"),
    `got ${notesF.length}`
  );
  check(
    "Fay's follow_updates hit the 5/day rate cap (many thresholds fired)",
    notesF.length === 5,
    `got ${notesF.length}`
  );

  // Rate cap: 5/day.
  const capResults: boolean[] = [];
  for (let i = 0; i < 6; i++) {
    const r = await createNotification({
      userId: userE.id,
      type: "follow_update",
      title: `Probe ${i}`,
      body: "rate cap probe",
    });
    capResults.push(r.created);
  }
  check(
    "first 5 notifications created, 6th dropped by the rate cap",
    capResults.filter(Boolean).length === 5 && capResults[5] === false,
    capResults.join(",")
  );
  check("unread count reflects the cap (5)", (await getUnreadCount(userE.id)) === 5);

  // Prefs: default on, writable.
  check("milestone pref defaults on", await getNotifyMilestonesPref(userA.id));
  check("Dan's pref is off", !(await getNotifyMilestonesPref(userD.id)));

  // ── Idempotency: second run changes nothing ────────────────────
  const stats2 = await runMilestoneDetection();
  check("second run records 0 new events", stats2.events === 0, `got ${stats2.events}`);
  check("second run grants 0 new awards", stats2.awards === 0, `got ${stats2.awards}`);
  check("second run sends 0 new notifications", stats2.notifications === 0, `got ${stats2.notifications}`);
  check(
    "climber still has exactly 3 events",
    (await getMilestoneEvents(ranking.id, climber.id)).length === 3
  );

  // ── 8. Movement from snapshots ────────────────────────────────
  // writeRankingSnapshot computes both boards from real data; the date
  // is an explicit param so the test can simulate two cron days.
  // Day 1 loved order: climber #1 (3 likes), others[0] #2 (2),
  // others[1] #3 (1).
  await addLike({ rankingId: ranking.id, profileId: climber.id, userId: userA.id });
  await addLike({ rankingId: ranking.id, profileId: climber.id, userId: userB.id });
  await addLike({ rankingId: ranking.id, profileId: climber.id, userId: userC.id });
  await addLike({ rankingId: ranking.id, profileId: others[0].id, userId: userA.id });
  await addLike({ rankingId: ranking.id, profileId: others[0].id, userId: userB.id });
  await addLike({ rankingId: ranking.id, profileId: others[1].id, userId: userA.id });
  await writeRankingSnapshot(ranking.id, "2026-09-28");
  await writeRankingSnapshot(ranking.id, "2026-09-28"); // duplicate write
  const profileCount = 25; // climber + 24 others at this point
  const day1Rows = (await db
    .prepare(
      `SELECT COUNT(*) AS n FROM ranking_snapshots
       WHERE ranking_id = ? AND board = 'loved' AND snapshot_date = '2026-09-28'`
    )
    .get(ranking.id)) as { n: number };
  check("snapshot write is idempotent", day1Rows.n === profileCount, `got ${day1Rows.n}`);
  check(
    "no movement with a single snapshot",
    (await getMovement(ranking.id, "loved")).size === 0
  );
  // Day 2: others[0] → 5 likes (#1), others[1] → 4 (#2), climber stays
  // 3 (#3); a brand-new nominee appears with 1 like (#4).
  await addLike({ rankingId: ranking.id, profileId: others[0].id, userId: userC.id });
  await addLike({ rankingId: ranking.id, profileId: others[0].id, userId: userD.id });
  await addLike({ rankingId: ranking.id, profileId: others[0].id, userId: userE.id });
  await addLike({ rankingId: ranking.id, profileId: others[1].id, userId: userB.id });
  await addLike({ rankingId: ranking.id, profileId: others[1].id, userId: userC.id });
  await addLike({ rankingId: ranking.id, profileId: others[1].id, userId: userD.id });
  const newcomer = await createProfile({
    rankingId: ranking.id,
    name: "Newcomer Nell",
    addedBy: userA.id,
  });
  await addLike({ rankingId: ranking.id, profileId: newcomer.id, userId: userF.id });
  await writeRankingSnapshot(ranking.id, "2026-09-29");
  const mv = await getMovement(ranking.id, "loved");
  // 26 entries: the 3 movers + the newcomer + the 22 zero-like nominees
  // who each slid down exactly one slot (no "same" survivors here).
  check("movement map has 26 entries", mv.size === 26, `got ${mv.size}`);
  check("climber moved down 2", mv.get(climber.id)?.direction === "down" && mv.get(climber.id)?.delta === 2);
  check("first nominee moved up 1", mv.get(others[0].id)?.direction === "up" && mv.get(others[0].id)?.delta === 1);
  check("second nominee moved up 1", mv.get(others[1].id)?.direction === "up" && mv.get(others[1].id)?.delta === 1);
  check("new entrant flagged new", mv.get(newcomer.id)?.direction === "new");
  check("shifted nominee moved down 1", mv.get(others[2].id)?.direction === "down" && mv.get(others[2].id)?.delta === 1);
  // The supported board only gained the newcomer (0 credits, bottom);
  // every existing profile kept its rank.
  const mvSupported = await getMovement(ranking.id, "supported");
  check(
    "supported board: newcomer is new, everyone else unchanged",
    (() => {
      const sm = mvSupported;
      if (sm.get(newcomer.id)?.direction !== "new") return false;
      for (const [pid, m] of sm) {
        if (pid !== newcomer.id && m.direction !== "same") return false;
      }
      return true;
    })()
  );

  // ── 9. Follows ───────────────────────────────────────────────
  check("Fay follows the ranking", await isFollowing(userF.id, "ranking", ranking.id));
  await follow(userF.id, "ranking", ranking.id);
  check(
    "re-follow is idempotent (still 1 follower)",
    (await countFollowers("ranking", ranking.id)) === 1
  );
  check("listFollows returns the ranking follow", (await listFollows(userF.id)).length === 1);
  const badType = await follow(userF.id, "user" as never, userA.id);
  check("user-follow target type rejected", badType.followed === false);
  const badTarget = await follow(userF.id, "ranking", "nope");
  check("follow of a missing ranking rejected", badTarget.followed === false);
  await unfollow(userF.id, "ranking", ranking.id);
  check("unfollow works", !(await isFollowing(userF.id, "ranking", ranking.id)));

  // ── 10. Discovery: real data only ─────────────────────────────
  const fresh = await getNewRankings(10);
  check("new-rankings discovery includes the test ranking", fresh.some((r) => r.id === ranking.id));
  // Underrated: few credits + real like traction.
  const gem = await createProfile({ rankingId: ranking.id, name: "Hidden Gem", addedBy: userA.id });
  await pay({ userId: userA.id, profileId: gem.id, credits: 200 });
  await addLike({ rankingId: ranking.id, profileId: gem.id, userId: userA.id });
  await addLike({ rankingId: ranking.id, profileId: gem.id, userId: userB.id });
  const underrated = await getUnderratedNominees(5000);
  // Scope to the test ranking: the best-effort demo seed may leave
  // partial seed rows in the throwaway DB.
  const inTestRanking = underrated.filter((u) => u.rankingId === ranking.id);
  check(
    "underrated discovery surfaces the liked-but-unbacked nominee",
    inTestRanking.some((u) => u.profile.id === gem.id)
  );
  check(
    "climber (1,510 credits) is NOT listed as underrated",
    !inTestRanking.some((u) => u.profile.id === climber.id)
  );

  // ── 11. Query-count guard: cron endpoints must stay fast on ──────
  // remote Turso, where every prepared statement is a network
  // round-trip. Counts statements during a 5 rankings × 10 nominees
  // fixture run of the exact cron paths. Pre-fix this measured 2,596
  // (snapshots) / 27,255 (milestones) on a 156-ranking seed — enough
  // to hang both endpoints in production (the Render crons run with a
  // 10-minute curl guard).
  const origPrepare = db.prepare.bind(db);
  let queryCount = 0;
  (db as { prepare: typeof db.prepare }).prepare = ((sql: string) => {
    queryCount++;
    return origPrepare(sql);
  }) as typeof db.prepare;
  try {
    const { writeAllRankingSnapshots } = await import(
      "@/db/rankingSnapshots"
    );
    const qcRankings: { id: string }[] = [];
    for (let r = 0; r < 5; r++) {
      const qcOwner = await mkUser(`qc${r}@example.com`, `QC Owner ${r}`);
      const qr = await createRanking({
        title: `QC Ranking ${r}`,
        country: "UK",
        city: "London",
        description: "query-count guard",
        createdBy: qcOwner.id,
      });
      qcRankings.push(qr);
      const qcBacker = await mkUser(`qcb${r}@example.com`, `QC Backer ${r}`);
      let topId = "";
      for (let i = 0; i < 10; i++) {
        const p = await createProfile({
          rankingId: qr.id,
          name: `QC Nominee ${r}-${i}`,
          addedBy: qcOwner.id,
        });
        if (i === 0) topId = p.id;
      }
      const payment = await createPendingPayment({
        userId: qcBacker.id,
        rankingId: qr.id,
        profileId: topId,
        packageId: "qc-pkg",
        credits: 1500,
        amountCents: 15000,
        currency: "gbp",
        visibilityChoice: "public",
        stripeCheckoutSessionId: `sess_${newId()}`,
      });
      await markPaymentCompleted(payment.id, `pi_${newId()}`);
      const granted = await creditProfileForPayment({
        profileId: topId,
        rankingId: qr.id,
        supporterUserId: qcBacker.id,
        paymentId: payment.id,
        credits: 1500,
        visibility: null,
      });
      if (!granted) throw new Error("qc credit grant failed");
      await recordBackingMoment({
        userId: qcBacker.id,
        rankingId: qr.id,
        profileId: topId,
        paymentId: payment.id,
        credits: 1500,
        rankAtSupport: null,
        totalCreditsAtSupport: 1500,
        backerCountAtSupport: 1,
        supportReason: "talent_spotter",
        supportReasonText: null,
        visibilityAtSupport: "public",
      });
    }

    queryCount = 0;
    const fleet = await writeAllRankingSnapshots("2030-01-02");
    const snapshotQueries = queryCount;
    check(
      "snapshot cron stays within query budget (<= 60)",
      snapshotQueries <= 60,
      `got ${snapshotQueries}`
    );
    check("fleet writer covered the 5 guard rankings", fleet.rankings >= 5);
    let guardRowsOk = true;
    for (const qr of qcRankings) {
      const n = (await origPrepare(
        `SELECT COUNT(*) AS n FROM ranking_snapshots WHERE ranking_id = ? AND snapshot_date = '2030-01-02'`
      ).get(qr.id)) as { n: number };
      // 10 nominees × 2 boards.
      if (n.n !== 20) guardRowsOk = false;
    }
    check("fleet writer wrote the same rows as per-ranking writes", guardRowsOk);
    queryCount = 0;
    const fleetAgain = await writeAllRankingSnapshots("2030-01-02");
    check(
      "fleet snapshot write is idempotent (0 new rows)",
      fleetAgain.rows === 0,
      `got ${fleetAgain.rows}`
    );

    queryCount = 0;
    const guardStats = await runMilestoneDetection();
    const milestoneQueries = queryCount;
    check(
      "milestone cron stays within query budget (<= 1500)",
      milestoneQueries <= 1500,
      `got ${milestoneQueries}`
    );
    check(
      "guard fixture recorded new milestone events",
      guardStats.events > 0,
      `got ${guardStats.events}`
    );
    check("guard milestone run had no errors", guardStats.errors === 0);
    const guardStats2 = await runMilestoneDetection();
    check(
      "second guard run records 0 new events",
      guardStats2.events === 0,
      `got ${guardStats2.events}`
    );
  } finally {
    (db as { prepare: typeof db.prepare }).prepare = origPrepare;
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll Phase 3 milestone checks passed.");
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
