// Phase 5.5 (story milestone notifications + thank my early backers)
// smoke test.
//
// Covers (brief §6):
//  1. Story templates render with real data (rank-at-support vs now).
//  2. "You were there early" only on proven climbs (award recipients).
//  3. backers_50: "one of the first" only for the provably earliest 50.
//  4. Copy rules: credits-only, no fiat, no causal claims, no pressure.
//  5. Thank action: unclaimed → denied; non-owner → denied.
//  6. Private backer receives the self-notification and is never named;
//     the nominee sees only the aggregate count.
//  7. notify_milestones opt-out → nothing sent; 5/day cap respected.
//  8. Seed accounts excluded from recipients and counts.
//  9. Rate limit: once per milestone scope; a new milestone unlocks a
//     new thank-you.
//
// Runs against a throwaway local SQLite file — NEVER production.
// Usage: DATA_DIR=$(mktemp -d /tmp/rephear-phase55-test.XXXXXX) npx tsx scripts/smoke-phase5.5-thanks.ts

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DATA_DIR = fs.mkdtempSync(
  path.join(os.tmpdir(), "smoke-phase5.5-thanks-")
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
  const { createProfile, claimProfile } = await import("@/db/profiles");
  const { creditProfileForPayment } = await import("@/db/creditTransactions");
  const { createPendingPayment, markPaymentCompleted } = await import(
    "@/db/payments"
  );
  const { recordBackingMoment } = await import("@/db/backingMoments");
  const { recordMilestoneEvent } = await import("@/db/milestones");
  const {
    buildThenNowLine,
    buildEarlyBackerStoryCopy,
    buildBackerMilestoneCopy,
    buildNomineeThanksCopy,
  } = await import("@/lib/storyNotifications");
  const {
    thankEarlyBackers,
    getLatestMilestoneScope,
  } = await import("@/db/nomineeThanks");
  const {
    listNotifications: getNotifications,
    setNotifyMilestonesPref,
    createNotification,
  } = await import("@/db/notifications");

  await ensureMigrated();
  const thanksTables = (await db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='nominee_thanks'`
    )
    .all()) as { name: string }[];
  check("nominee_thanks table exists", thanksTables.length === 1);

  // ── 1. Copy unit tests (pure, real data) ─────────────────────────
  const thenNow = buildThenNowLine("Mia", 23, 3);
  check(
    "THEN→NOW renders real ranks",
    thenNow === "You backed Mia at #23. Mia is now #3.",
    thenNow
  );
  check(
    "null rank-at-support degrades honestly",
    buildThenNowLine("Mia", null, 3) ===
      "You backed Mia before Mia was even ranked. Mia is now #3."
  );
  check(
    "null rank-at-event omits the now-line",
    buildThenNowLine("Mia", 23, null) === "You backed Mia at #23."
  );

  const early = buildEarlyBackerStoryCopy({
    profileName: "Mia",
    milestoneType: "entered_top_10",
    rankAtSupport: 23,
    rankAtEvent: 10,
    provenEarly: true,
    amongFirstBackers: false,
  });
  check(
    "early variant title carries the proof-gated claim",
    early.title === "🏆 Mia entered the Top 10 — you were there early",
    early.title
  );
  check(
    "early variant body has THEN→NOW + judgement framing",
    early.body.includes("at #23") &&
      early.body.includes("now #10") &&
      /judgement called it early/i.test(early.body),
    early.body
  );

  const story = buildBackerMilestoneCopy({
    profileName: "Mia",
    milestoneType: "entered_top_10",
    rankAtSupport: 23,
    rankAtEvent: 3,
    provenEarly: false,
    amongFirstBackers: false,
  });
  check(
    "entry story: THEN→NOW, no causal claim",
    story.body === "You backed Mia at #23. Mia is now #3.",
    story.body
  );
  const first50 = buildBackerMilestoneCopy({
    profileName: "Mia",
    milestoneType: "backers_50",
    rankAtSupport: 40,
    rankAtEvent: 61,
    provenEarly: false,
    amongFirstBackers: true,
  });
  check(
    "backers_50: provably-first backer gets 'one of the first'",
    /one of the first/i.test(first50.body),
    first50.body
  );
  const later50 = buildBackerMilestoneCopy({
    profileName: "Mia",
    milestoneType: "backers_50",
    rankAtSupport: 40,
    rankAtEvent: 61,
    provenEarly: false,
    amongFirstBackers: false,
  });
  check(
    "backers_50: later backer does NOT get 'one of the first'",
    !/one of the first/i.test(later50.body),
    later50.body
  );
  const k1 = buildBackerMilestoneCopy({
    profileName: "Mia",
    milestoneType: "first_1k_credits",
    rankAtSupport: 55,
    rankAtEvent: 25,
    provenEarly: false,
    amongFirstBackers: false,
  });
  check(
    "credits milestone: credits-only, no fiat",
    /1,000 Support Credits/.test(k1.title) && !/[£$€]/.test(k1.title + k1.body),
    k1.title
  );

  const allCopy = [early, story, first50, later50, k1].map(
    (c) => `${c.title} ${c.body}`
  );
  check(
    "story copy: no causal claims (never 'you moved')",
    allCopy.every((t) => !/you moved|moved .* into|because of you/i.test(t)),
    JSON.stringify(allCopy)
  );
  check(
    "story copy: no re-support pressure",
    allCopy.every((t) => !/support again|back (her|him|them) again|top up/i.test(t))
  );
  check(
    "story copy: no fiat anywhere",
    allCopy.every((t) => !/[£$€]\s?\d|\d\s?(usd|gbp|dollars|pounds)/i.test(t))
  );

  const thanks = buildNomineeThanksCopy("Mia");
  check(
    "thanks preset matches the §16 template",
    /thanked her early backers/i.test(thanks.title) &&
      /you were one of them/i.test(thanks.body),
    `${thanks.title} / ${thanks.body}`
  );
  check(
    "thanks copy never contains the word 'private'",
    !/private/i.test(`${thanks.title} ${thanks.body}`)
  );

  // ── 2. Thank flow fixtures ───────────────────────────────────────
  const pw = await bcrypt.hash("password123", 10);
  const mkUser = (email: string, name: string) =>
    createUser({ email, passwordHash: pw, name });
  const owner = await mkUser("t55owner@example.com", "Tina Owner");
  const stranger = await mkUser("t55stranger@example.com", "Sam Stranger");
  const userA = await mkUser("t55a@example.com", "Amy Backer");
  const userB = await mkUser("t55b@example.com", "Ben Backer");
  const userC = await mkUser("t55c@example.com", "Cara Private");
  const userD = await mkUser("t55d@example.com", "Dan Optout");
  const userE = await mkUser("t55e@example.com", "Erin Capped");
  const seedId = "seed_community_55t";
  await db
    .prepare(
      `INSERT INTO users (id, email, password_hash, name, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    )
    .run(seedId, "t55seed@example.com", pw, "Seed Sam");

  const ranking = await createRanking({
    title: "Phase 5.5 Test Ranking",
    country: "UK",
    city: "London",
    description: "smoke test",
    createdBy: owner.id,
  });
  const nominee = await createProfile({
    rankingId: ranking.id,
    name: "Mia Star",
    addedBy: owner.id,
  });
  const unclaimed = await createProfile({
    rankingId: ranking.id,
    name: "Uma Unclaimed",
    addedBy: owner.id,
  });

  async function pay(
    userId: string,
    profileId: string,
    credits: number,
    visibilityChoice: "public" | "private" = "public"
  ) {
    const payment = await createPendingPayment({
      userId,
      rankingId: ranking.id,
      profileId,
      packageId: "t55-pkg",
      credits,
      amountCents: credits * 10,
      currency: "gbp",
      visibilityChoice,
      stripeCheckoutSessionId: `sess_${newId()}`,
    });
    await markPaymentCompleted(payment.id, `pi_${newId()}`);
    const granted = await creditProfileForPayment({
      profileId,
      rankingId: ranking.id,
      supporterUserId: userId,
      paymentId: payment.id,
      credits,
      visibility: visibilityChoice,
    });
    if (!granted) throw new Error("credit grant failed");
    return payment.id;
  }
  const moment = (
    paymentId: string,
    userId: string,
    rankAtSupport: number | null,
    visibility: "public" | "private",
    supportedAt: string
  ) =>
    recordBackingMoment({
      userId,
      rankingId: ranking.id,
      profileId: nominee.id,
      paymentId,
      credits: 100,
      rankAtSupport,
      totalCreditsAtSupport: 100,
      backerCountAtSupport: 1,
      supportReason: null,
      supportReasonText: null,
      visibilityAtSupport: visibility,
    }).then(() =>
      db
        .prepare(
          `UPDATE backing_moments SET supported_at = ? WHERE payment_id = ?`
        )
        .run(supportedAt, paymentId)
    );

  // Staggered moments: A earliest, then B, C (private), D, seed, E.
  await moment(await pay(userA.id, nominee.id, 100), userA.id, 40, "public", "2026-09-20 10:00:00");
  await moment(await pay(userB.id, nominee.id, 100), userB.id, 41, "public", "2026-09-21 10:00:00");
  await moment(await pay(userC.id, nominee.id, 100, "private"), userC.id, 42, "private", "2026-09-22 10:00:00");
  await moment(await pay(userD.id, nominee.id, 100), userD.id, 43, "public", "2026-09-23 10:00:00");
  await moment(await pay(seedId, nominee.id, 100), seedId, 44, "public", "2026-09-24 10:00:00");
  await moment(await pay(userE.id, nominee.id, 100), userE.id, 45, "public", "2026-09-25 10:00:00");
  await setNotifyMilestonesPref(userD.id, false);
  // Erin already at the 5/day cap.
  for (let i = 0; i < 5; i++) {
    await createNotification({
      userId: userE.id,
      type: "follow_update",
      title: `Probe ${i}`,
      body: "cap probe",
    });
  }

  // ── 3. Gating ────────────────────────────────────────────────────
  const deniedUnclaimed = await thankEarlyBackers({
    profileId: unclaimed.id,
    actorUserId: owner.id,
  });
  check(
    "unclaimed nominee → denied",
    !deniedUnclaimed.ok && deniedUnclaimed.reason === "not_claimed"
  );
  await claimProfile(nominee.id, owner.id);
  const deniedStranger = await thankEarlyBackers({
    profileId: nominee.id,
    actorUserId: stranger.id,
  });
  check(
    "non-owner → denied",
    !deniedStranger.ok && deniedStranger.reason === "not_owner"
  );
  check(
    "denial carries no recipient data",
    Object.keys(deniedStranger).every((k) =>
      ["ok", "reason", "scope"].includes(k)
    )
  );

  // ── 4. First thank (scope: latest milestone) ─────────────────────
  await recordMilestoneEvent({
    rankingId: ranking.id,
    profileId: nominee.id,
    type: "entered_top_10",
    rankAtEvent: 9,
    creditsAtEvent: 600,
    backersAtEvent: 6,
  });
  check(
    "latest milestone scope resolves",
    (await getLatestMilestoneScope(ranking.id, nominee.id)) === "entered_top_10"
  );
  const first = await thankEarlyBackers({
    profileId: nominee.id,
    actorUserId: owner.id,
  });
  check(
    "owner thank succeeds",
    first.ok === true,
    JSON.stringify(first)
  );
  if (first.ok) {
    check(
      "sent counts every early backer incl. private (seed excluded): 5",
      first.sent === 5,
      `got ${first.sent}`
    );
    check("scope is the latest milestone", first.scope === "entered_top_10");
    check(
      "response shape carries no names or recipient lists",
      Object.keys(first).every((k) => ["ok", "sent", "scope"].includes(k)),
      JSON.stringify(Object.keys(first))
    );
  }

  const notesA = await getNotifications(userA.id, 50);
  const notesC = await getNotifications(userC.id, 50);
  check(
    "public backer got the nominee_thanks notification",
    notesA.some((n) => n.type === "nominee_thanks"),
    `got ${notesA.length}`
  );
  check(
    "private backer got the SELF-directed thank-you",
    notesC.some((n) => n.type === "nominee_thanks"),
    `got ${notesC.length}`
  );
  const thanksNote = notesC.find((n) => n.type === "nominee_thanks")!;
  check(
    "thank-you copy names nobody but the nominee, never 'private'",
    !/Amy|Ben|Dan|Erin|private/i.test(`${thanksNote.title} ${thanksNote.body}`),
    `${thanksNote.title} / ${thanksNote.body}`
  );
  check(
    "opt-out Dan got nothing",
    (await getNotifications(userD.id, 50)).length === 0
  );
  check(
    "seed account got nothing",
    (await getNotifications(seedId, 50)).length === 0
  );

  // ── 5. Rate limit: once per milestone scope ──────────────────────
  const repeat = await thankEarlyBackers({
    profileId: nominee.id,
    actorUserId: owner.id,
  });
  check(
    "repeat thank for the same milestone → already_thanked",
    !repeat.ok && repeat.reason === "already_thanked"
  );
  check(
    "repeat thank sent nothing new",
    (await getNotifications(userA.id, 50)).filter(
      (n) => n.type === "nominee_thanks"
    ).length === 1
  );

  // A new milestone unlocks a new thank-you.
  await recordMilestoneEvent({
    rankingId: ranking.id,
    profileId: nominee.id,
    type: "reached_1",
    rankAtEvent: 1,
    creditsAtEvent: 5000,
    backersAtEvent: 6,
  });
  const second = await thankEarlyBackers({
    profileId: nominee.id,
    actorUserId: owner.id,
  });
  check(
    "new milestone unlocks a new thank-you",
    second.ok === true && second.scope === "reached_1",
    JSON.stringify(second)
  );
  check(
    "second thank delivered again",
    (await getNotifications(userA.id, 50)).filter(
      (n) => n.type === "nominee_thanks"
    ).length === 2
  );

  // ── 6. 5/day cap respected on the thank path ─────────────────────
  await recordMilestoneEvent({
    rankingId: ranking.id,
    profileId: nominee.id,
    type: "credits_10k",
    rankAtEvent: 1,
    creditsAtEvent: 10000,
    backersAtEvent: 6,
  });
  const third = await thankEarlyBackers({
    profileId: nominee.id,
    actorUserId: owner.id,
  });
  check("third thank (new scope) succeeds", third.ok === true);
  check(
    "capped Erin got no thank-you (5/day cap)",
    (await getNotifications(userE.id, 50)).filter(
      (n) => n.type === "nominee_thanks"
    ).length === 0,
    `got ${(await getNotifications(userE.id, 50)).length}`
  );
  check(
    "uncapped backers still got the third thank-you",
    (await getNotifications(userA.id, 50)).filter(
      (n) => n.type === "nominee_thanks"
    ).length === 3
  );

  // ── 7. Runner integration: backers_50 "one of the first" ─────────
  // Separate ranking: 55 backers on the climber, 55 filler nominees
  // above it so no entry threshold fires (keeps the 5/day cap out of
  // the way and isolates the backers_50 story copy).
  const ranking2 = await createRanking({
    title: "Phase 5.5 Backers-50 Ranking",
    country: "UK",
    city: "London",
    description: "smoke test",
    createdBy: owner.id,
  });
  const filler = await mkUser("t55filler@example.com", "Phil Filler");
  const climber = await createProfile({
    rankingId: ranking2.id,
    name: "Clara Climber",
    addedBy: filler.id,
  });
  for (let i = 0; i < 55; i++) {
    await createProfile({
      rankingId: ranking2.id,
      name: `Filler ${i}`,
      addedBy: filler.id,
    });
  }
  async function pay2(userId: string, profileId: string, credits: number) {
    const payment = await createPendingPayment({
      userId,
      rankingId: ranking2.id,
      profileId,
      packageId: "t55-pkg2",
      credits,
      amountCents: credits * 10,
      currency: "gbp",
      visibilityChoice: "public",
      stripeCheckoutSessionId: `sess_${newId()}`,
    });
    await markPaymentCompleted(payment.id, `pi_${newId()}`);
    const granted = await creditProfileForPayment({
      profileId,
      rankingId: ranking2.id,
      supporterUserId: userId,
      paymentId: payment.id,
      credits,
      visibility: null,
    });
    if (!granted) throw new Error("credit grant failed");
    return payment.id;
  }
  const fillerIds = (
    (await db
      .prepare(`SELECT id FROM profiles WHERE ranking_id = ? AND id != ?`)
      .all(ranking2.id, climber.id)) as { id: string }[]
  ).map((r) => r.id);
  for (const fid of fillerIds) {
    await pay2(filler.id, fid, 1000);
  }
  const backers: { id: string }[] = [];
  for (let i = 0; i < 55; i++) {
    const u = await mkUser(`t55b50_${i}@example.com`, `B50 Backer ${i}`);
    backers.push(u);
    const paymentId = await pay2(u.id, climber.id, 10);
    await recordBackingMoment({
      userId: u.id,
      rankingId: ranking2.id,
      profileId: climber.id,
      paymentId,
      credits: 10,
      rankAtSupport: 60,
      totalCreditsAtSupport: 10,
      backerCountAtSupport: 1,
      supportReason: null,
      supportReasonText: null,
      visibilityAtSupport: "public",
    });
    // Stagger: backer i is the (i+1)-th earliest.
    const day = String(i + 1).padStart(2, "0");
    await db
      .prepare(`UPDATE backing_moments SET supported_at = ? WHERE payment_id = ?`)
      .run(`2026-08-${day} 10:00:00`, paymentId);
  }

  const { runMilestoneDetection } = await import("@/lib/milestoneRunner");
  const stats = await runMilestoneDetection();
  check("runner completed without errors", stats.errors === 0);

  let first50Ok = true;
  let laterOk = true;
  for (let i = 0; i < 55; i++) {
    const notes = await getNotifications(backers[i].id, 50);
    const b50 = notes.find((n) => n.type === "backed_nominee_milestone");
    if (!b50) {
      (i < 50 ? (first50Ok = false) : (laterOk = false));
      continue;
    }
    const hasFirst = /one of the first/i.test(b50.body);
    if (i < 50 && !hasFirst) first50Ok = false;
    if (i >= 50 && hasFirst) laterOk = false;
  }
  check(
    "earliest 50 backers got 'one of the first'",
    first50Ok
  );
  check(
    "backers 51–55 did NOT get 'one of the first'",
    laterOk
  );
  const sample = (
    await getNotifications(backers[0].id, 50)
  ).find((n) => n.type === "backed_nominee_milestone")!;
  check(
    "backers_50 copy is credits-clean and THEN→NOW honest",
    /50th backer/.test(sample.title) && /at #60/.test(sample.body),
    `${sample.title} / ${sample.body}`
  );

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll Phase 5.5 checks passed.");
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
