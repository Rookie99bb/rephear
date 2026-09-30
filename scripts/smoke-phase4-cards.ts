// Phase 4 (nominee growth loop — milestone share cards) smoke test.
//
// Covers (brief §Scope / §Privacy / §Tests):
//   1. Migrations apply idempotently (nominee_approach_notices exists).
//   2. Card data for all 4 types: correct rank/count at generation time,
//      traced to milestone_events rows or live leaderboard reads.
//   3. PNG renders 1080×1080 for each type (IHDR parsed from bytes).
//   4. Deep links: /s/ short link preferred, /n/TOKEN fallback; both
//      resolve to the nominee.
//   5. Claimed-gating server-side: unclaimed → denied, wrong viewer →
//      denied (UI-hiding is not the gate — getShareCardData enforces).
//   6. milestone_events-less nominee → no card of any type.
//   7. Type-specific unavailability: no entered_top_10 event → no top10
//      card; <2 snapshots → no rising card (never inferred).
//   8. Claimed-owner milestone notifications: fired on threshold, link
//      to the share page, credits-only copy; opt-out respected;
//      unclaimed → nothing.
//   9. Top-10 approach nudge: fires once ever (UNIQUE guard), gap and
//      rank bounds respected.
//  10. Privacy: no fiat symbols on cards; private backers count in
//      totals but their names appear nowhere; seed accounts excluded
//      from backer counts.
//  11. Write-path purity: card reads change nothing in
//      conviction_records / backing_moments / credit_transactions.
//
// Runs against a throwaway local SQLite file — NEVER production.
// Usage: DATA_DIR=$(mktemp -d /tmp/rephear-phase4-test.XXXXXX) npx tsx scripts/smoke-phase4-cards.ts

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DATA_DIR = fs.mkdtempSync(
  path.join(os.tmpdir(), "smoke-phase4-cards-")
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

function pngDims(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 33) return null;
  const sig = buf.subarray(0, 8);
  const pngSig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!sig.equals(pngSig)) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

async function main() {
  const { ensureMigrated } = await import("@/db/schema");
  const { db } = await import("@/db/client");
  const { newId } = await import("@/lib/id");
  const bcrypt = (await import("bcryptjs")).default;
  const { createUser } = await import("@/db/users");
  const { createRanking } = await import("@/db/rankings");
  const { createProfile, claimProfile } = await import("@/db/profiles");
  const { creditProfileForPayment } = await import(
    "@/db/creditTransactions"
  );
  const { createPendingPayment, markPaymentCompleted } = await import(
    "@/db/payments"
  );

  // ── Fixtures ──────────────────────────────────────────────
  await ensureMigrated();
  await ensureMigrated();
  const tables = (await db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='nominee_approach_notices'`
    )
    .all()) as unknown as { name: string }[];
  check("1. nominee_approach_notices migrated", tables.length === 1);

  const mkUser = (email: string, name: string) =>
    createUser({
      email,
      passwordHash: bcrypt.hashSync("pw", 4),
      name,
    });
  const owner = await mkUser("owner4@test.dev", "Owner Four");
  const stranger = await mkUser("stranger4@test.dev", "Stranger Four");
  const quietOwner = await mkUser("quiet4@test.dev", "Quiet Owner");
  const backerA = await mkUser("backerA4@test.dev", "Backer A");
  const backerB = await mkUser("backerB4@test.dev", "Backer B");
  const seedUser = await mkUser("seedx@test.dev", "Seed X");
  // Turn this account into a seed account (excluded from backer counts).
  await db
    .prepare(`UPDATE users SET id = ? WHERE id = ?`)
    .run("seed_community_cards", seedUser.id);
  const seedId = "seed_community_cards";
  const { setNotifyMilestonesPref } = await import("@/db/notifications");
  await setNotifyMilestonesPref(quietOwner.id, false);

  const ranking = await createRanking({
    title: "Test Ranking Phase4",
    country: "UK",
    city: "London",
    description: "smoke",
    createdBy: owner.id,
  });
  const p = (name: string) =>
    createProfile({ rankingId: ranking.id, name, addedBy: owner.id });
  const p1 = await p("Mia Star"); // claimed by owner, will have events
  const p2 = await p("Unclaimed Uma"); // never claimed
  const p3 = await p("Quiet Quinn"); // claimed, zero events
  const p4 = await p("Optout Olive"); // claimed by quietOwner
  const p5 = await p("Nominated Ned"); // claimed, nominated event only
  await claimProfile(p1.id, owner.id);
  await claimProfile(p3.id, owner.id);
  await claimProfile(p4.id, quietOwner.id);
  await claimProfile(p5.id, owner.id);

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
  }

  // Board setup, day 1: p2 500, p3 400, p4 300, p5 200, p1 100 → p1 #5.
  await pay({ userId: backerA.id, profileId: p2.id, credits: 500 });
  await pay({ userId: backerA.id, profileId: p3.id, credits: 400 });
  await pay({ userId: backerA.id, profileId: p4.id, credits: 300 });
  await pay({ userId: backerA.id, profileId: p5.id, credits: 200 });
  await pay({ userId: backerA.id, profileId: p1.id, credits: 100 });
  // Private backer still counts in totals (visibility-blind aggregates).
  await pay({
    userId: backerB.id,
    profileId: p1.id,
    credits: 50,
    visibilityChoice: "private",
  });
  // Seed support must NOT inflate the public backer count (its credits
  // still count in board totals, same as production).
  await pay({ userId: seedId, profileId: p1.id, credits: 30 });

  const { writeRankingSnapshot } = await import("@/db/rankingSnapshots");
  await writeRankingSnapshot(ranking.id, "2026-09-20");

  // Day 2: p1 climbs to #1 (up 4) with real backing.
  await pay({ userId: backerA.id, profileId: p1.id, credits: 2000 });
  await writeRankingSnapshot(ranking.id, "2026-09-21");

  const { recordMilestoneEvent } = await import("@/db/milestones");
  await recordMilestoneEvent({
    rankingId: ranking.id,
    profileId: p1.id,
    type: "nominated",
    rankAtEvent: 5,
    creditsAtEvent: 150,
    backersAtEvent: 2,
  });
  await recordMilestoneEvent({
    rankingId: ranking.id,
    profileId: p1.id,
    type: "entered_top_10",
    rankAtEvent: 8,
    creditsAtEvent: 1200,
    backersAtEvent: 2,
  });
  await recordMilestoneEvent({
    rankingId: ranking.id,
    profileId: p1.id,
    type: "backers_50",
    rankAtEvent: 3,
    creditsAtEvent: 1800,
    backersAtEvent: 50,
  });
  await recordMilestoneEvent({
    rankingId: ranking.id,
    profileId: p4.id,
    type: "entered_top_10",
    rankAtEvent: 9,
    creditsAtEvent: 900,
    backersAtEvent: 1,
  });
  await recordMilestoneEvent({
    rankingId: ranking.id,
    profileId: p5.id,
    type: "nominated",
    rankAtEvent: 4,
    creditsAtEvent: 200,
    backersAtEvent: 1,
  });

  const { getShareCardData, getAvailableShareCards } = await import(
    "@/lib/shareCards"
  );
  const { renderShareCardPng } = await import("@/lib/shareCardRenderer");
  const card = (profileId: string, type: "rank" | "top10" | "backers" | "rising", viewer: string) =>
    getShareCardData({ rankingId: ranking.id, profileId, type, viewerUserId: viewer });

  // ── 2. Card data: correct values at generation ─────────────
  const rankCard = await card(p1.id, "rank", owner.id);
  check(
    "2a. rank card ok, headline reflects live rank",
    rankCard.ok && rankCard.data.headline === "I'm #1",
    JSON.stringify(rankCard)
  );
  const top10Card = await card(p1.id, "top10", owner.id);
  check(
    "2b. top10 card traces to entered_top_10 event",
    top10Card.ok && top10Card.data.statLine.includes("1,200"),
    JSON.stringify(top10Card).slice(0, 200)
  );
  const backersCard = await card(p1.id, "backers", owner.id);
  check(
    "2c. backers card shows live backer count (seed excluded)",
    backersCard.ok && backersCard.data.headline.startsWith("2 backers"),
    JSON.stringify(backersCard).slice(0, 200)
  );
  const risingCard = await card(p1.id, "rising", owner.id);
  check(
    "2d. rising card on real up-4 movement",
    risingCard.ok && risingCard.data.headline === "Rising ↗",
    JSON.stringify(risingCard).slice(0, 200)
  );

  // ── 3. PNG renders 1080×1080 ───────────────────────────────
  if (rankCard.ok && top10Card.ok && backersCard.ok && risingCard.ok) {
    for (const [label, d] of [
      ["rank", rankCard.data],
      ["top10", top10Card.data],
      ["backers", backersCard.data],
      ["rising", risingCard.data],
    ] as const) {
      const buf = await renderShareCardPng(d);
      const dims = pngDims(buf);
      check(
        `3. PNG ${label} is 1080×1080`,
        dims !== null && dims.w === 1080 && dims.h === 1080,
        dims ? `${dims.w}×${dims.h}` : "not a PNG"
      );
    }
  } else {
    check("3. PNG renders (cards available)", false, "card data missing");
  }

  // ── 4. Deep links ─────────────────────────────────────────
  const { createCampaignLink, findCampaignLinkBySlug } = await import(
    "@/db/campaignLinks"
  );
  await createCampaignLink({ slug: "miastart4", profileId: p1.id, rankingId: ranking.id });
  const withLink = await card(p1.id, "rank", owner.id);
  check(
    "4a. /s/ short link preferred when present",
    withLink.ok && withLink.data.deepLink.endsWith("/s/miastart4"),
    withLink.ok ? withLink.data.deepLink : "n/a"
  );
  const slugTarget = await findCampaignLinkBySlug("miastart4");
  check(
    "4b. /s/ slug resolves to the nominee",
    slugTarget !== null && slugTarget.profileName === "Mia Star"
  );
  const noLink = await card(p5.id, "rank", owner.id);
  check(
    "4c. /n/TOKEN fallback without campaign link",
    noLink.ok && noLink.data.deepLink.includes("/n/"),
    noLink.ok ? noLink.data.deepLink : JSON.stringify(noLink)
  );

  // ── 5/6/7. Gating ─────────────────────────────────────────
  const deniedUnclaimed = await card(p2.id, "rank", owner.id);
  check(
    "5a. unclaimed nominee denied (server-side)",
    !deniedUnclaimed.ok && deniedUnclaimed.reason === "not_claimed"
  );
  const deniedStranger = await card(p1.id, "rank", stranger.id);
  check(
    "5b. non-owner viewer denied (server-side)",
    !deniedStranger.ok && deniedStranger.reason === "not_owner"
  );
  const deniedAnon = await getShareCardData({
    rankingId: ranking.id,
    profileId: p1.id,
    type: "rank",
    viewerUserId: null,
  });
  check(
    "5c. anonymous viewer denied",
    !deniedAnon.ok && deniedAnon.reason === "not_owner"
  );
  const noEvents = await card(p3.id, "top10", owner.id);
  check(
    "6. milestone-less nominee gets no card",
    !noEvents.ok && noEvents.reason === "no_milestones"
  );
  const noTop10Event = await card(p5.id, "top10", owner.id);
  check(
    "7a. no entered_top_10 event → no top10 card",
    !noTop10Event.ok && noTop10Event.reason === "unavailable"
  );
  const noBackersEvent = await card(p5.id, "backers", owner.id);
  check(
    "7b. no backers_50 event → no backers card",
    !noBackersEvent.ok && noBackersEvent.reason === "unavailable"
  );
  // Fresh ranking with a single snapshot → rising unavailable.
  const ranking2 = await createRanking({
    title: "Fresh Ranking Phase4",
    country: "UK",
    city: "London",
    description: "smoke2",
    createdBy: owner.id,
  });
  const q1 = await createProfile({ rankingId: ranking2.id, name: "Q Solo", addedBy: owner.id });
  await claimProfile(q1.id, owner.id);
  await recordMilestoneEvent({
    rankingId: ranking2.id,
    profileId: q1.id,
    type: "nominated",
    rankAtEvent: 1,
    creditsAtEvent: 0,
    backersAtEvent: 0,
  });
  await writeRankingSnapshot(ranking2.id, "2026-09-21");
  const risingSingle = await getShareCardData({
    rankingId: ranking2.id,
    profileId: q1.id,
    type: "rising",
    viewerUserId: owner.id,
  });
  check(
    "7c. single snapshot → no rising card (never inferred)",
    !risingSingle.ok && risingSingle.reason === "unavailable"
  );
  const available = await getAvailableShareCards({
    rankingId: ranking.id,
    profileId: p1.id,
    viewerUserId: owner.id,
  });
  check(
    "7d. owner sees all 4 available cards",
    available.length === 4,
    `got ${available.length}`
  );

  // ── 8. Claimed-owner milestone notifications ──────────────
  const { notifyClaimedOwnerForMilestone, checkTop10Approach } = await import(
    "@/lib/nomineeMilestones"
  );
  const { listNotifications } = await import("@/db/notifications");
  const n1 = await notifyClaimedOwnerForMilestone({
    rankingId: ranking.id,
    rankingTitle: ranking.title,
    profileId: p1.id,
    type: "entered_top_10",
  });
  check("8a. claimed owner notified on milestone", n1.notified === true);
  const ownerNotes = await listNotifications(owner.id, 20);
  const mnote = ownerNotes.find((n) => n.type === "nominee_milestone");
  check(
    "8b. notification row: type, share-page link, credits-only copy",
    !!mnote &&
      mnote.link === `/profiles/${p1.id}/share` &&
      /Top 10/.test(mnote.title) &&
      !/[£$€]/.test(`${mnote.title} ${mnote.body}`),
    mnote ? `${mnote.title} | ${mnote.link}` : "missing"
  );
  const n2 = await notifyClaimedOwnerForMilestone({
    rankingId: ranking.id,
    rankingTitle: ranking.title,
    profileId: p2.id,
    type: "entered_top_10",
  });
  check(
    "8c. unclaimed nominee → no owner notification",
    n2.notified === false && n2.reason === "unclaimed"
  );
  const n3 = await notifyClaimedOwnerForMilestone({
    rankingId: ranking.id,
    rankingTitle: ranking.title,
    profileId: p4.id,
    type: "entered_top_10",
  });
  check(
    "8d. opt-out owner → no notification",
    n3.notified === false,
    JSON.stringify(n3)
  );
  const n4 = await notifyClaimedOwnerForMilestone({
    rankingId: ranking.id,
    rankingTitle: ranking.title,
    profileId: p1.id,
    type: "nominated",
  });
  check(
    "8e. 'nominated' skipped for owner pings",
    n4.notified === false && n4.reason === "skip_nominated"
  );

  // ── 9. Top-10 approach nudge ──────────────────────────────
  const a1 = await checkTop10Approach({
    rankingId: ranking.id,
    rankingTitle: ranking.title,
    profileId: p1.id,
    rank: 11,
    totalCredits: 992,
    top10CutoffCredits: 1000,
  });
  check("9a. approach nudge fires in range", a1.noticed === true, JSON.stringify(a1));
  const approachNotes = await listNotifications(owner.id, 20);
  const anote = approachNotes.find((n) => /credits from the Top 10/.test(n.title));
  check(
    "9b. approach copy states the real gap, credits-only",
    !!anote && /8 credits/.test(anote.title) && !/[£$€]/.test(anote.title),
    anote?.title ?? "missing"
  );
  const a2 = await checkTop10Approach({
    rankingId: ranking.id,
    rankingTitle: ranking.title,
    profileId: p1.id,
    rank: 11,
    totalCredits: 995,
    top10CutoffCredits: 1000,
  });
  check(
    "9c. approach fires once ever (UNIQUE guard)",
    a2.noticed === false && a2.reason === "already_noticed",
    JSON.stringify(a2)
  );
  const a3 = await checkTop10Approach({
    rankingId: ranking.id,
    rankingTitle: ranking.title,
    profileId: p5.id,
    rank: 12,
    totalCredits: 100,
    top10CutoffCredits: 2000,
  });
  check(
    "9d. gap > 1000 → no nudge",
    a3.noticed === false && a3.reason === "gap_out_of_range"
  );
  const a4 = await checkTop10Approach({
    rankingId: ranking.id,
    rankingTitle: ranking.title,
    profileId: p1.id,
    rank: 7,
    totalCredits: 2000,
    top10CutoffCredits: 1000,
  });
  check(
    "9e. already in Top 10 → no nudge",
    a4.noticed === false && a4.reason === "already_top_10"
  );

  // ── 10. Privacy ───────────────────────────────────────────
  const privCard = await card(p1.id, "rank", owner.id);
  const cardText = privCard.ok
    ? `${privCard.data.headline} ${privCard.data.subline} ${privCard.data.statLine} ${privCard.data.cta}`
    : "";
  check("10a. no fiat symbols anywhere on card", !/[£$€]/.test(cardText), cardText);
  check(
    "10b. no supporter names on card (counts only)",
    !/Backer A|Backer B/.test(cardText)
  );
  const board = (await import("@/db/milestones")).getSupportedBoardState;
  const state = await board(ranking.id);
  const p1state = state.find((r) => r.profileId === p1.id);
  check(
    "10c. private backer counts in totals; seed excluded",
    p1state?.backerCount === 2,
    `backerCount=${p1state?.backerCount}`
  );

  // ── 11. Write-path purity ─────────────────────────────────
  const count = async (t: string) =>
    ((await db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get()) as unknown as { c: number }).c;
  const before = {
    conviction: await count("conviction_records"),
    moments: await count("backing_moments"),
    credits: await count("credit_transactions"),
  };
  await getAvailableShareCards({ rankingId: ranking.id, profileId: p1.id, viewerUserId: owner.id });
  if (rankCard.ok) await renderShareCardPng(rankCard.data);
  const after = {
    conviction: await count("conviction_records"),
    moments: await count("backing_moments"),
    credits: await count("credit_transactions"),
  };
  check(
    "11. card reads write nothing to conviction/moments/credits",
    before.conviction === after.conviction &&
      before.moments === after.moments &&
      before.credits === after.credits,
    JSON.stringify({ before, after })
  );

  console.log(failures === 0 ? "\nAll Phase 4 smoke checks passed." : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
