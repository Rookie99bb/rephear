// Phase 5.6 (backer story cards) smoke test.
//
// Covers (brief §Scope / §Privacy / §Tests):
//   1. Early Backer card: THEN→NOW renders real first-moment data
//      (backed at #23 → now #1); requires the Early Backer award as data
//      proof (no award → 404).
//   2. Milestone card: tied to a real milestone_events row; fabricated
//      milestone id → 404.
//   3. Private cards: unsigned URL → 403 (unsigned); another user → 403
//      (not_backer); author with valid signed token → 200 data with
//      visibility=private; tampered/expired token → invalid.
//   4. Reason echo: public preset reasons render on public cards;
//      custom free text NEVER renders on a public card, only on the
//      author's own signed card.
//   5. Journey card: counts match backing_moments (people backed, Top-10
//      climbs after joining); seed accounts excluded.
//   6. PNG renders 1080×1080 for all three card types.
//   7. Copy: credits-only (no fiat), no causal claims.
//   8. Write-path purity: card reads write nothing to
//      conviction_records / backing_moments / credit_transactions /
//      milestone_events.
//   9. getStoryCardLinks: public → plain API URL; private → signed
//      /cards/<token> URL.
//
// Runs against a throwaway local SQLite file — NEVER production.
// Usage: DATA_DIR=$(mktemp -d /tmp/rephear-phase5.6-test.XXXXXX) npx tsx scripts/smoke-phase5.6-cards.ts

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DATA_DIR = fs.mkdtempSync(
  path.join(os.tmpdir(), "smoke-phase5.6-cards-")
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
  const { createProfile } = await import("@/db/profiles");
  const { creditProfileForPayment } = await import("@/db/creditTransactions");
  const { createPendingPayment, markPaymentCompleted } = await import(
    "@/db/payments"
  );
  const { recordBackingMoment } = await import("@/db/backingMoments");
  const { recordMilestoneEvent, awardEarlyBackers } = await import(
    "@/db/milestones"
  );

  await ensureMigrated();
  await ensureMigrated();

  const mkUser = (email: string, name: string) =>
    createUser({ email, passwordHash: bcrypt.hashSync("pw", 4), name });
  const backerPublic = await mkUser("pub6@test.dev", "Public Backer");
  const backerCustom = await mkUser("cus6@test.dev", "Custom Reasoner");
  const backerPrivate = await mkUser("priv6@test.dev", "Private Backer");
  const backerLate = await mkUser("late6@test.dev", "Late Backer");
  const stranger = await mkUser("stranger6@test.dev", "Stranger Six");
  const seedUser = await mkUser("seed6@test.dev", "Seed Six");
  await db
    .prepare(`UPDATE users SET id = ? WHERE id = ?`)
    .run("seed_community_cards6", seedUser.id);
  const seedId = "seed_community_cards6";
  // Private backer's aggregate journey must also stay private.
  await db
    .prepare(`UPDATE users SET show_supports = 'private' WHERE id = ?`)
    .run(backerPrivate.id);

  const ranking = await createRanking({
    title: "Test Ranking Phase5.6",
    country: "UK",
    city: "London",
    description: "smoke",
    createdBy: backerPublic.id,
  });
  const ranking2 = await createRanking({
    title: "Second Ranking Phase5.6",
    country: "UK",
    city: "London",
    description: "smoke",
    createdBy: backerPublic.id,
  });
  const p1 = await createProfile({
    rankingId: ranking.id,
    name: "Mia Star",
    addedBy: backerPublic.id,
  });
  const p2 = await createProfile({
    rankingId: ranking.id,
    name: "Uma Second",
    addedBy: backerPublic.id,
  });
  const p3 = await createProfile({
    rankingId: ranking2.id,
    name: "Nora Third",
    addedBy: backerPublic.id,
  });

  // Backing moments (immutable snapshots) + matching credit
  // transactions carrying the read-time visibility choice.
  async function back(opts: {
    userId: string;
    rankingId: string;
    profileId: string;
    credits: number;
    rankAtSupport: number | null;
    supportedAt: string;
    reason: string | null;
    reasonText?: string | null;
    visibility: "public" | "private";
  }) {
    const payment = await createPendingPayment({
      userId: opts.userId,
      rankingId: opts.rankingId,
      profileId: opts.profileId,
      packageId: "smoke-pkg-56",
      credits: opts.credits,
      amountCents: opts.credits * 10,
      currency: "gbp",
      visibilityChoice: opts.visibility,
      stripeCheckoutSessionId: `sess_${newId()}`,
    });
    await markPaymentCompleted(payment.id, `pi_${newId()}`);
    const paymentId = payment.id;
    await creditProfileForPayment({
      profileId: opts.profileId,
      rankingId: opts.rankingId,
      supporterUserId: opts.userId,
      paymentId,
      credits: opts.credits,
      visibility: opts.visibility,
    });
    await recordBackingMoment({
      userId: opts.userId,
      rankingId: opts.rankingId,
      profileId: opts.profileId,
      paymentId,
      credits: opts.credits,
      rankAtSupport: opts.rankAtSupport,
      totalCreditsAtSupport: opts.credits,
      backerCountAtSupport: 1,
      supportReason: opts.reason,
      supportReasonText: opts.reasonText ?? null,
      visibilityAtSupport: opts.visibility,
    });
    await db
      .prepare(`UPDATE backing_moments SET supported_at = ? WHERE payment_id = ?`)
      .run(opts.supportedAt, paymentId);
  }

  // Board: p1 ends #1 (most credits), p2 #2.
  await back({
    userId: backerPublic.id, rankingId: ranking.id, profileId: p1.id,
    credits: 100, rankAtSupport: 23, supportedAt: "2026-09-01 10:00:00",
    reason: "believe_potential", visibility: "public",
  });
  await back({
    userId: backerCustom.id, rankingId: ranking.id, profileId: p1.id,
    credits: 60, rankAtSupport: 23, supportedAt: "2026-09-02 10:00:00",
    reason: "custom", reasonText: "She reminds me of home",
    visibility: "public",
  });
  await back({
    userId: backerPrivate.id, rankingId: ranking.id, profileId: p1.id,
    credits: 50, rankAtSupport: 23, supportedAt: "2026-09-01 11:00:00",
    reason: "custom", reasonText: "Nobody must know",
    visibility: "private",
  });
  await back({
    userId: backerLate.id, rankingId: ranking.id, profileId: p1.id,
    credits: 40, rankAtSupport: 5, supportedAt: "2026-09-20 10:00:00",
    reason: "love_work", visibility: "public",
  });
  await back({
    userId: seedId, rankingId: ranking.id, profileId: p1.id,
    credits: 30, rankAtSupport: 23, supportedAt: "2026-09-01 09:00:00",
    reason: null, visibility: "public",
  });
  await back({
    userId: backerPublic.id, rankingId: ranking.id, profileId: p2.id,
    credits: 20, rankAtSupport: 2, supportedAt: "2026-09-03 10:00:00",
    reason: "love_work", visibility: "public",
  });
  await back({
    userId: backerPublic.id, rankingId: ranking2.id, profileId: p3.id,
    credits: 10, rankAtSupport: 1, supportedAt: "2026-09-04 10:00:00",
    reason: null, visibility: "public",
  });
  // Extra credits so p1 is genuinely #1 now.
  for (const [profileId, credits] of [[p1.id, 2000], [p2.id, 100]] as const) {
    const boost = await createPendingPayment({
      userId: backerPublic.id,
      rankingId: ranking.id,
      profileId,
      packageId: "smoke-pkg-56",
      credits,
      amountCents: credits * 10,
      currency: "gbp",
      visibilityChoice: "public",
      stripeCheckoutSessionId: `sess_${newId()}`,
    });
    await markPaymentCompleted(boost.id, `pi_${newId()}`);
    await creditProfileForPayment({
      profileId, rankingId: ranking.id, supporterUserId: backerPublic.id,
      paymentId: boost.id, credits, visibility: "public",
    });
  }

  // Real milestone: p1 entered the Top 10 on Sep 15 — AFTER the early
  // backers joined (Sep 1/2), BEFORE the late backer (Sep 20).
  await recordMilestoneEvent({
    rankingId: ranking.id, profileId: p1.id, type: "entered_top_10",
    rankAtEvent: 8, creditsAtEvent: 1200, backersAtEvent: 4,
  });
  const eventRow = (await db
    .prepare(
      `SELECT id FROM milestone_events WHERE ranking_id = ? AND profile_id = ? AND type = 'entered_top_10'`
    )
    .get(ranking.id, p1.id)) as unknown as { id: string };
  const eventId = eventRow.id;
  await db
    .prepare(`UPDATE milestone_events SET created_at = ? WHERE id = ?`)
    .run("2026-09-15 10:00:00", eventId);

  // Early Backer awards (WHEN-based): rank 23 backers qualify for
  // entered_top_10; the rank-5 late backer does not.
  const awarded = await awardEarlyBackers({
    rankingId: ranking.id, profileId: p1.id, milestoneType: "entered_top_10",
  });
  check(
    "0. early backers awarded (rank-23 yes, rank-5 no)",
    awarded.includes(backerPublic.id) &&
      awarded.includes(backerPrivate.id) &&
      awarded.includes(backerCustom.id) &&
      !awarded.includes(backerLate.id) &&
      !awarded.includes(seedId),
    JSON.stringify(awarded)
  );

  const { getStoryCardData, getStoryCardLinks } = await import(
    "@/lib/storyCards"
  );
  const { createStoryCardToken, verifyStoryCardToken } = await import(
    "@/lib/storyCardTokens"
  );
  const { renderShareCardPng } = await import("@/lib/shareCardRenderer");

  const early = (userId: string, signed: boolean) =>
    getStoryCardData({
      type: "early-backer", rankingId: ranking.id, profileId: p1.id,
      viewerUserId: userId, signed,
    });

  // ── 1. Early Backer card: real THEN→NOW ────────────────────
  const pubCard = await early(backerPublic.id, false);
  check(
    "1a. public early-backer card ok, THEN→NOW from real moments",
    pubCard.ok &&
      pubCard.visibility === "public" &&
      pubCard.data.headline === "I Was There Early" &&
      /at #23/.test(pubCard.data.subline) &&
      /now #1/.test(pubCard.data.subline),
    pubCard.ok ? pubCard.data.subline : JSON.stringify(pubCard)
  );
  check(
    "1b. preset reason echo renders on public card",
    pubCard.ok && /believe in her potential/.test(pubCard.data.statLine),
    pubCard.ok ? pubCard.data.statLine : "n/a"
  );
  const lateCard = await early(backerLate.id, false);
  check(
    "1c. no Early Backer award → no card (no data proof)",
    !lateCard.ok && lateCard.reason === "no_award",
    JSON.stringify(lateCard)
  );
  const strangerCard = await early(stranger.id, false);
  check(
    "1d. non-backer denied",
    !strangerCard.ok && strangerCard.reason === "not_backer"
  );

  // ── 2. Milestone card: real event only ─────────────────────
  const msCard = await getStoryCardData({
    type: "milestone", rankingId: ranking.id, profileId: p1.id,
    milestoneId: eventId, viewerUserId: backerPublic.id, signed: false,
  });
  check(
    "2a. milestone card traces to the real event row",
    msCard.ok && /Top 10/.test(msCard.data.headline) && /1,200/.test(msCard.data.statLine),
    msCard.ok ? `${msCard.data.headline} | ${msCard.data.statLine}` : JSON.stringify(msCard)
  );
  check(
    "2b. 'before this' claim only with timestamp proof",
    msCard.ok && /before this/.test(msCard.data.subline),
    msCard.ok ? msCard.data.subline : "n/a"
  );
  const lateMs = await getStoryCardData({
    type: "milestone", rankingId: ranking.id, profileId: p1.id,
    milestoneId: eventId, viewerUserId: backerLate.id, signed: false,
  });
  check(
    "2c. late backer: no 'before' claim (timestamps disprove it)",
    lateMs.ok && !/before this/.test(lateMs.data.subline),
    lateMs.ok ? lateMs.data.subline : "n/a"
  );
  const fabricated = await getStoryCardData({
    type: "milestone", rankingId: ranking.id, profileId: p1.id,
    milestoneId: "milestone_does_not_exist", viewerUserId: backerPublic.id,
    signed: false,
  });
  check(
    "2d. fabricated milestone id → 404 (never invented)",
    !fabricated.ok && fabricated.reason === "no_milestone"
  );
  const wrongProfile = await getStoryCardData({
    type: "milestone", rankingId: ranking.id, profileId: p2.id,
    milestoneId: eventId, viewerUserId: backerPublic.id, signed: false,
  });
  check(
    "2e. event id scoped to (ranking, profile) — cross-profile reuse fails",
    !wrongProfile.ok && wrongProfile.reason === "no_milestone"
  );

  // ── 3. Private cards: signed, author-only, non-enumerable ───
  const privUnsigned = await early(backerPrivate.id, false);
  check(
    "3a. private backer, unsigned URL → denied",
    !privUnsigned.ok && privUnsigned.reason === "unsigned"
  );
  const token = createStoryCardToken({
    userId: backerPrivate.id, type: "early-backer",
    rankingId: ranking.id, profileId: p1.id, milestoneId: null,
  });
  const verified = verifyStoryCardToken(token);
  check(
    "3b. token verifies and binds user+scope",
    !!verified && verified.u === backerPrivate.id && verified.t === "early-backer"
  );
  const privSigned = await early(backerPrivate.id, true);
  check(
    "3c. author over signed path → card, visibility private",
    privSigned.ok && privSigned.visibility === "private",
    JSON.stringify(privSigned).slice(0, 160)
  );
  check(
    "3d. private card names no other supporter",
    privSigned.ok &&
      !/Public Backer|Custom Reasoner|Late Backer/.test(
        `${privSigned.data.headline} ${privSigned.data.subline} ${privSigned.data.statLine}`
      )
  );
  const tampered = verifyStoryCardToken(token.slice(0, -2) + "xx");
  check("3e. tampered token → invalid", tampered === null);
  const expired = createStoryCardToken({
    userId: backerPrivate.id, type: "early-backer",
    rankingId: ranking.id, profileId: p1.id, milestoneId: null,
    ttlSeconds: -1,
  });
  check("3f. expired token → invalid", verifyStoryCardToken(expired) === null);
  const otherUserToken = createStoryCardToken({
    userId: stranger.id, type: "early-backer",
    rankingId: ranking.id, profileId: p1.id, milestoneId: null,
  });
  const otherPayload = verifyStoryCardToken(otherUserToken);
  check(
    "3g. token is bound to its author (stranger's token ≠ private backer)",
    !!otherPayload && otherPayload.u === stranger.id && otherPayload.u !== backerPrivate.id
  );

  // ── 4. Reason echo privacy ─────────────────────────────────
  const customPublic = await getStoryCardData({
    type: "early-backer", rankingId: ranking.id, profileId: p1.id,
    viewerUserId: backerCustom.id, signed: false,
  });
  check(
    "4a. custom reason text NEVER on a public card",
    customPublic.ok && !/She reminds me of home/.test(customPublic.data.statLine),
    customPublic.ok ? customPublic.data.statLine : "n/a"
  );
  const customPrivate = await getStoryCardData({
    type: "early-backer", rankingId: ranking.id, profileId: p1.id,
    viewerUserId: backerPrivate.id, signed: true,
  });
  check(
    "4b. custom reason text renders on the author's own signed card",
    customPrivate.ok && /Nobody must know/.test(customPrivate.data.statLine),
    customPrivate.ok ? customPrivate.data.statLine : "n/a"
  );

  // ── 5. Journey card: counts only ───────────────────────────
  const journey = await getStoryCardData({
    type: "journey", viewerUserId: backerPublic.id, signed: false,
  });
  check(
    "5a. journey counts match backing_moments (3 people, 1 Top-10 climb)",
    journey.ok &&
      /backed 3 people/.test(journey.data.subline) &&
      /1 entered the Top 10 after I joined/.test(journey.data.subline),
    journey.ok ? journey.data.subline : JSON.stringify(journey)
  );
  check(
    "5b. journey stat line is credits-only",
    journey.ok && /Support Credits/.test(journey.data.statLine) && !/[£$€]/.test(journey.data.statLine),
    journey.ok ? journey.data.statLine : "n/a"
  );
  const journeyPrivUnsigned = await getStoryCardData({
    type: "journey", viewerUserId: backerPrivate.id, signed: false,
  });
  check(
    "5c. private default → journey card needs the signed path too",
    !journeyPrivUnsigned.ok && journeyPrivUnsigned.reason === "unsigned"
  );
  const journeyEmpty = await getStoryCardData({
    type: "journey", viewerUserId: stranger.id, signed: false,
  });
  check(
    "5d. no moments → no journey card (never invented)",
    !journeyEmpty.ok && journeyEmpty.reason === "unavailable"
  );

  // ── 6. PNG renders 1080×1080 ───────────────────────────────
  if (pubCard.ok && msCard.ok && journey.ok) {
    for (const [label, d] of [
      ["early-backer", pubCard.data],
      ["milestone", msCard.data],
      ["journey", journey.data],
    ] as const) {
      const buf = await renderShareCardPng(d);
      const dims = pngDims(buf);
      check(
        `6. PNG ${label} is 1080×1080`,
        dims !== null && dims.w === 1080 && dims.h === 1080,
        dims ? `${dims.w}×${dims.h}` : "not a PNG"
      );
    }
  } else {
    check("6. PNG renders (cards available)", false, "card data missing");
  }

  // ── 7. Copy: no fiat, no causal claims ─────────────────────
  const allText = [pubCard, msCard, journey, privSigned, customPrivate]
    .filter((r) => r.ok)
    .map((r) => `${r.data.headline} ${r.data.subline} ${r.data.statLine} ${r.data.cta}`)
    .join(" | ");
  check("7a. no fiat symbols on any card", !/[£$€]/.test(allText), allText.slice(0, 200));
  check(
    "7b. no causal claims (you moved / because of you)",
    !/you moved|moved her|because of you|thanks to you/i.test(allText)
  );

  // ── 9. Card links: public plain, private signed ────────────
  const pubLinks = await getStoryCardLinks(backerPublic.id);
  const privLinks = await getStoryCardLinks(backerPrivate.id);
  check(
    "9a. public backer links are plain API URLs",
    pubLinks.length > 0 && pubLinks.every((l) => l.href.startsWith("/api/story-cards?") && !l.isPrivate),
    JSON.stringify(pubLinks.map((l) => l.href))
  );
  const privEarly = privLinks.find((l) => /Early Backer/.test(l.label));
  check(
    "9b. private backer links are signed, non-enumerable /cards/<token>",
    !!privEarly && privEarly.isPrivate && /^\/cards\/[A-Za-z0-9\-_.]+$/.test(privEarly.href),
    privEarly?.href ?? "missing"
  );
  check(
    "9c. private token URL has no ID sequence to crawl",
    !!privEarly && !privEarly.href.includes(backerPrivate.id)
  );

  // ── 8. Write-path purity ───────────────────────────────────
  const count = async (t: string) =>
    ((await db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get()) as unknown as { c: number }).c;
  const before = {
    conviction: await count("conviction_records"),
    moments: await count("backing_moments"),
    credits: await count("credit_transactions"),
    milestones: await count("milestone_events"),
  };
  await getStoryCardLinks(backerPublic.id);
  await getStoryCardLinks(backerPrivate.id);
  if (pubCard.ok) await renderShareCardPng(pubCard.data);
  const after = {
    conviction: await count("conviction_records"),
    moments: await count("backing_moments"),
    credits: await count("credit_transactions"),
    milestones: await count("milestone_events"),
  };
  check(
    "8. card reads write nothing to conviction/moments/credits/milestones",
    JSON.stringify(before) === JSON.stringify(after),
    JSON.stringify({ before, after })
  );

  console.log(failures === 0 ? "\nAll Phase 5.6 smoke checks passed." : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
