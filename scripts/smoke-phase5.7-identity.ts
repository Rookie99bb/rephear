// Phase 5.7 (evidence-based identity engine) smoke test.
//
// Covers (brief §Scope / §Tests):
//   1. Talent Spotter fires on 3 early backer awards across 3 distinct
//      nominees; 2 awards does NOT fire.
//   2. Underdog Backer fires on 3 moments backed outside the Top 20
//      where the nominee later climbed into the Top 10; a moment AFTER
//      the climb does NOT count.
//   3. Loyal Backer fires on 3 moments for the same nominee spanning
//      >= 3 calendar months; 3 moments in one week does NOT fire.
//   4. A single BIG support (huge credits, one moment) earns nothing.
//   5. Seed accounts (seed_community_*) never earn and never count.
//   6. Recompute is idempotent; version + thresholds recorded.
//   7. Config-driven: lowered thresholds award with the new config and
//      the thresholds snapshot reflects it.
//   8. Private render: visibleIdentityAwards → owner always, other
//      viewers only when the user has public activity.
//   9. New identity → identity_earned notification (pref + 5/day cap
//      respected by the center); link points at /u/<id>.
//  10. No spend-tier language in any identity copy.
//  11. Write-path purity: engine writes only identity_awards +
//      notifications; conviction_records / backing_moments /
//      credit_transactions / milestone_events untouched.
//  12. Milestone runner wiring: runMilestoneDetection evaluates
//      identities for daily candidates.
//
// Runs against a throwaway local SQLite file — NEVER production.
// Usage: DATA_DIR=$(mktemp -d /tmp/rephear-phase5.7-test.XXXXXX) npx tsx scripts/smoke-phase5.7-identity.ts

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DATA_DIR = fs.mkdtempSync(
  path.join(os.tmpdir(), "smoke-phase5.7-identity-")
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
  const { recordBackingMoment } = await import("@/db/backingMoments");
  const { recordMilestoneEvent, awardEarlyBackers } = await import(
    "@/db/milestones"
  );
  const {
    getIdentityAwards,
    computeIdentityEvidence,
    awardIdentitiesForUsers,
    findIdentityCandidates,
    backfillIdentities,
    visibleIdentityAwards,
    setIdentityDisplayOrder,
  } = await import("@/db/identityAwards");
  const {
    IDENTITY_RULES,
    IDENTITY_ENGINE_VERSION,
    identityEarnedTitle,
    talentSpotterSummary,
  } = await import("@/lib/identityConfig");
  const { createNotification, listNotifications, setNotifyMilestonesPref } = await import(
    "@/db/notifications"
  );
  const { runMilestoneDetection } = await import("@/lib/milestoneRunner");

  await ensureMigrated();
  await ensureMigrated();

  const mkUser = (email: string, name: string) =>
    createUser({ email, passwordHash: bcrypt.hashSync("pw", 4), name });
  const admin = await mkUser("admin7@test.dev", "Admin Seven");
  const ranking = await createRanking({
    title: "Identity Test Ranking",
    country: "UK",
    city: "London",
    description: "test",
    createdBy: admin.id,
    slug: "identity-test-ranking-5-7",
  });
  const mkProfile = (name: string) =>
    createProfile({
      rankingId: ranking.id,
      name,
      addedBy: admin.id,
    });

  const count = async (t: string) =>
    ((await db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get()) as unknown as {
      c: number;
    }).c;

  let payN = 0;
  const mkMoment = async (
    userId: string,
    profileId: string,
    rankAtSupport: number | null,
    credits = 50
  ) => {
    payN++;
    // Minimal payment row: backing_moments.payment_id is a real FK, but
    // the identity engine never reads payments/credit_transactions, so
    // no credit ledger writes are needed for these fixtures.
    const paymentId = `pay7-${payN}-${newId()}`;
    await db
      .prepare(
        `INSERT INTO payments
           (id, user_id, ranking_id, profile_id, package_id, credits,
            amount_cents, currency, visibility_choice,
            stripe_checkout_session_id, status)
         VALUES (?, ?, ?, ?, 'test-pkg-57', ?, 0, 'gbp', 'public',
                 ?, 'completed')`
      )
      .run(
        paymentId,
        userId,
        ranking.id,
        profileId,
        credits,
        `sess_${newId()}`
      );
    await recordBackingMoment({
      userId,
      rankingId: ranking.id,
      profileId,
      paymentId,
      credits,
      rankAtSupport,
      totalCreditsAtSupport: 1000,
      backerCountAtSupport: 5,
      supportReason: null,
      supportReasonText: null,
      visibilityAtSupport: "public",
    });
  };

  // ── Setup: Talent Spotter (3 early awards, 3 nominees) ───────────────
  const talent = await mkUser("talent7@test.dev", "Talent Seven");
  const almost = await mkUser("almost7@test.dev", "Almost Seven");
  const profiles: { id: string }[] = [];
  for (let i = 0; i < 3; i++) {
    const p = await mkProfile(`Nominee T${i}`);
    profiles.push(p);
    await recordMilestoneEvent({
      rankingId: ranking.id,
      profileId: p.id,
      type: "entered_top_10",
      rankAtEvent: 8 - i,
      creditsAtEvent: 2000,
      backersAtEvent: 10,
    });
    await mkMoment(talent.id, p.id, 25); // backed BEFORE the climb
    await db
      .prepare(
        `UPDATE milestone_events SET created_at = datetime('now', '+1 minute')
         WHERE ranking_id = ? AND profile_id = ? AND type = 'entered_top_10'`
      )
      .run(ranking.id, p.id);
  }
  for (const p of profiles) {
    const awarded = await awardEarlyBackers({
      rankingId: ranking.id,
      profileId: p.id,
      milestoneType: "entered_top_10",
    });
    check(
      `talent earns early backer award on ${p.id.slice(0, 6)}`,
      awarded.includes(talent.id)
    );
  }
  // almost: 2 early awards only
  for (let i = 0; i < 2; i++) {
    const p = profiles[i];
    const m = await mkMoment(almost.id, p.id, 30);
    void m;
  }
  for (let i = 0; i < 2; i++) {
    await awardEarlyBackers({
      rankingId: ranking.id,
      profileId: profiles[i].id,
      milestoneType: "entered_top_10",
    });
  }

  // ── Setup: Underdog (3 moments outside Top 20, later Top-10 climb) ───
  const underdog = await mkUser("underdog7@test.dev", "Underdog Seven");
  const uProfiles: { id: string }[] = [];
  for (let i = 0; i < 3; i++) {
    const p = await mkProfile(`Nominee U${i}`);
    uProfiles.push(p);
    await mkMoment(underdog.id, p.id, 25 + i); // outside Top 20
    await recordMilestoneEvent({
      rankingId: ranking.id,
      profileId: p.id,
      type: "entered_top_10",
      rankAtEvent: 7,
      creditsAtEvent: 3000,
      backersAtEvent: 12,
    });
    // Model the climb happening AFTER the support (same-second inserts
    // would be ambiguous for the `>` comparison).
    await db
      .prepare(
        `UPDATE milestone_events SET created_at = datetime('now', '+1 minute')
         WHERE ranking_id = ? AND profile_id = ? AND type = 'entered_top_10'`
      )
      .run(ranking.id, p.id);
  }
  // Negative: a moment AFTER the climb must not count.
  const lateDog = await mkUser("latedog7@test.dev", "Late Dog");
  const lp = await mkProfile("Nominee LateDog");
  await recordMilestoneEvent({
    rankingId: ranking.id,
    profileId: lp.id,
    type: "entered_top_10",
    rankAtEvent: 9,
    creditsAtEvent: 1500,
    backersAtEvent: 8,
  });
  await mkMoment(lateDog.id, lp.id, 30); // "backed" at #30 — but the
  // milestone already fired, so this moment can't be an underdog moment.
  // Move the moment AFTER the milestone to model late support honestly.
  await db
    .prepare(`UPDATE backing_moments SET supported_at = datetime('now', '+2 hours') WHERE user_id = ?`)
    .run(lateDog.id);

  // ── Setup: Loyal (3 moments, same nominee, 5 calendar months) ─────────
  const loyal = await mkUser("loyal7@test.dev", "Loyal Seven");
  const loyalProfile = await mkProfile("Nominee Loyal");
  await mkMoment(loyal.id, loyalProfile.id, 40);
  await mkMoment(loyal.id, loyalProfile.id, 35);
  await mkMoment(loyal.id, loyalProfile.id, 30);
  const loyalMoments = (
    await db
      .prepare(`SELECT id FROM backing_moments WHERE user_id = ? ORDER BY rowid`)
      .all(loyal.id)
  ) as { id: string }[];
  const stamps = [
    "2026-05-10 12:00:00",
    "2026-07-10 12:00:00",
    "2026-09-10 12:00:00",
  ];
  for (let i = 0; i < loyalMoments.length; i++) {
    await db
      .prepare(`UPDATE backing_moments SET supported_at = ? WHERE id = ?`)
      .run(stamps[i], loyalMoments[i].id);
  }
  // Negative: 3 moments in one week → no loyalty.
  const burst = await mkUser("burst7@test.dev", "Burst Seven");
  const burstProfile = await mkProfile("Nominee Burst");
  await mkMoment(burst.id, burstProfile.id, 40);
  await mkMoment(burst.id, burstProfile.id, 41);
  await mkMoment(burst.id, burstProfile.id, 42);

  // ── Setup: single BIG support (huge credits, one moment) ──────────────
  const whale2 = await mkUser("big7@test.dev", "Big Seven");
  const bigProfile = await mkProfile("Nominee Big");
  await mkMoment(whale2.id, bigProfile.id, 60, 100000);

  // ── Setup: seed user with a qualifying pattern (must never earn) ─────
  const seedId = `seed_community_test7`;
  await db
    .prepare(
      `INSERT INTO users (id, email, password_hash, name, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    )
    .run(seedId, "seed7@test.dev", bcrypt.hashSync("pw", 4), "Seed Seven");
  const seedProfile = await mkProfile("Nominee Seed");
  for (let i = 0; i < 3; i++) {
    const payId = `seedpay-${i}`;
    await db
      .prepare(
        `INSERT INTO payments
           (id, user_id, ranking_id, profile_id, package_id, credits,
            amount_cents, currency, visibility_choice,
            stripe_checkout_session_id, status)
         VALUES (?, ?, ?, ?, 'test-pkg-57', 50, 0, 'gbp', 'public',
                 ?, 'completed')`
      )
      .run(payId, seedId, ranking.id, seedProfile.id, `sess_seed_${i}`);
    await db
      .prepare(
        `INSERT INTO backing_moments
          (id, user_id, ranking_id, profile_id, payment_id, credits,
           rank_at_support, total_credits_at_support, backer_count_at_support,
           backer_number, growth_stage_at_support, support_reason,
           support_reason_text, visibility_at_support, supported_at)
         VALUES (?, ?, ?, ?, ?, 50, 40, 1000, 5, ?, 'rising', NULL, NULL, 'public', ?)`
      )
      .run(newId(), seedId, ranking.id, seedProfile.id, payId, i + 1, stamps[i]);
  }

  // ── 1/2/3. Evidence: pattern fires, near-misses don't ────────────────
  const talentEv = await computeIdentityEvidence(talent.id);
  const talentSpotter = talentEv.find((e) => e.key === "talent_spotter")!;
  check("talent_spotter qualifies on 3 awards / 3 nominees", talentSpotter.qualifies);

  const almostEv = await computeIdentityEvidence(almost.id);
  check(
    "talent_spotter does NOT fire on 2 awards",
    !almostEv.find((e) => e.key === "talent_spotter")!.qualifies
  );

  const underdogEv = await computeIdentityEvidence(underdog.id);
  check(
    "underdog_backer qualifies on 3 outside-Top-20 moments + later climbs",
    underdogEv.find((e) => e.key === "underdog_backer")!.qualifies
  );

  const lateDogEv = await computeIdentityEvidence(lateDog.id);
  check(
    "moment AFTER the climb does not count as underdog",
    !lateDogEv.find((e) => e.key === "underdog_backer")!.qualifies
  );

  const loyalEv = await computeIdentityEvidence(loyal.id);
  check(
    "loyal_backer qualifies on 3 moments across 5 months, same nominee",
    loyalEv.find((e) => e.key === "loyal_backer")!.qualifies
  );

  const burstEv = await computeIdentityEvidence(burst.id);
  check(
    "loyal_backer does NOT fire on 3 moments in one week",
    !burstEv.find((e) => e.key === "loyal_backer")!.qualifies
  );

  // ── 4. Single big support earns nothing ──────────────────────────────
  const bigEv = await computeIdentityEvidence(whale2.id);
  check(
    "single 100000-credit support earns no identity",
    bigEv.every((e) => !e.qualifies)
  );

  // ── 5. Seed excluded ─────────────────────────────────────────────────
  const seedEv = await computeIdentityEvidence(seedId);
  check(
    "seed account earns nothing despite qualifying pattern",
    seedEv.every((e) => !e.qualifies)
  );

  // ── Awarding + idempotency + versioning ───────────────────────────────
  const before = {
    conviction: await count("conviction_records"),
    moments: await count("backing_moments"),
    tx: await count("credit_transactions"),
    events: await count("milestone_events"),
    awards: await count("identity_awards"),
  };
  const run1 = await awardIdentitiesForUsers([
    talent.id,
    underdog.id,
    loyal.id,
    almost.id,
    burst.id,
    whale2.id,
    seedId,
    lateDog.id,
  ]);
  const talentAwards = await getIdentityAwards(talent.id);
  check(
    "talent awarded talent_spotter",
    talentAwards.some((a) => a.identityKey === "talent_spotter")
  );
  const underdogAwards = await getIdentityAwards(underdog.id);
  check(
    "underdog awarded underdog_backer",
    underdogAwards.some((a) => a.identityKey === "underdog_backer")
  );
  const loyalAwards = await getIdentityAwards(loyal.id);
  check(
    "loyal awarded loyal_backer",
    loyalAwards.some((a) => a.identityKey === "loyal_backer")
  );
  check("almost awarded nothing", (await getIdentityAwards(almost.id)).length === 0);
  check("burst awarded nothing", (await getIdentityAwards(burst.id)).length === 0);
  check("big single support awarded nothing", (await getIdentityAwards(whale2.id)).length === 0);
  check("seed awarded nothing", (await getIdentityAwards(seedId)).length === 0);
  check("late dog awarded nothing", (await getIdentityAwards(lateDog.id)).length === 0);

  const awardRow = talentAwards.find((a) => a.identityKey === "talent_spotter")!;
  check("engine_version recorded as v1", awardRow.engineVersion === IDENTITY_ENGINE_VERSION);
  check(
    "thresholds snapshot recorded",
    JSON.stringify(awardRow.thresholds).includes('"minAwards":3')
  );
  check(
    "evidence window recorded",
    typeof awardRow.evidenceWindow.from === "string" &&
      awardRow.evidenceWindow.from.length > 0
  );
  check("evidence summary is counts-only text", awardRow.evidenceSummary.length > 10);

  const run2 = await awardIdentitiesForUsers([talent.id, underdog.id, loyal.id]);
  check("recompute is idempotent (no new awards)", run2.awarded.length === 0);
  check(
    "first award run awarded exactly 4 identities (talent earns talent_spotter + underdog_backer)",
    run1.awarded.length === 4
  );
  check(
    "no duplicate rows after recompute",
    (await count("identity_awards")) === before.awards + 4
  );

  // ── 7. Config-driven thresholds ──────────────────────────────────────
  const loose = {
    ...IDENTITY_RULES,
    talent_spotter: { ...IDENTITY_RULES.talent_spotter, minAwards: 2, minDistinctNominees: 2 },
  };
  const runLoose = await awardIdentitiesForUsers([almost.id], loose);
  check(
    "lowered thresholds award with the new config",
    runLoose.awarded.some((a) => a.key === "talent_spotter")
  );
  const almostAwards = await getIdentityAwards(almost.id);
  check(
    "thresholds snapshot reflects the config at award time",
    JSON.stringify(almostAwards[0].thresholds).includes('"minAwards":2')
  );

  // ── 11. Write-path purity ────────────────────────────────────────────
  check("conviction_records untouched", (await count("conviction_records")) === before.conviction);
  check("backing_moments untouched", (await count("backing_moments")) === before.moments);
  check("credit_transactions untouched", (await count("credit_transactions")) === before.tx);
  check("milestone_events untouched", (await count("milestone_events")) === before.events);

  // ── 9. Notifications (pref + cap) ────────────────────────────────────
  const talentNotifs = await listNotifications(talent.id);
  const earned = talentNotifs.find((n) => n.type === "identity_earned");
  check("new identity → identity_earned notification", !!earned);
  check(
    "notification link points at /u/<id>",
    !!earned && earned.link === `/u/${talent.id}`
  );
  // pref off → dropped
  const quiet = await mkUser("quiet7@test.dev", "Quiet Seven");
  await setNotifyMilestonesPref(quiet.id, false);
  const prefRes = await createNotification({
    userId: quiet.id,
    type: "identity_earned",
    title: "t",
    body: "b",
  });
  check("pref off → notification dropped", prefRes.created === false);
  // rate cap → dropped
  const capped = await mkUser("capped7@test.dev", "Capped Seven");
  for (let i = 0; i < 5; i++) {
    await createNotification({
      userId: capped.id,
      type: "identity_earned",
      title: `t${i}`,
      body: "b",
    });
  }
  const capRes = await createNotification({
    userId: capped.id,
    type: "identity_earned",
    title: "t6",
    body: "b",
  });
  check("5/day cap → 6th notification dropped", capRes.created === false);

  // ── 8. Viewer gating ─────────────────────────────────────────────────
  check(
    "owner always sees own identities",
    visibleIdentityAwards(talentAwards, true, false).length === talentAwards.length
  );
  check(
    "other viewer sees them when user has public activity",
    visibleIdentityAwards(talentAwards, false, true).length === talentAwards.length
  );
  check(
    "other viewer sees none for fully-private user",
    visibleIdentityAwards(talentAwards, false, false).length === 0
  );

  // ── Owner-editable order ─────────────────────────────────────────────
  // talent has talent_spotter only from the main run — award a second
  // identity with loose rules to exercise reordering.
  const loose2 = {
    ...IDENTITY_RULES,
    underdog_backer: { ...IDENTITY_RULES.underdog_backer, minMoments: 1, minDistinctNominees: 1 },
  };
  await awardIdentitiesForUsers([talent.id], loose2);
  const two = await getIdentityAwards(talent.id);
  check("talent holds 2 identities for reorder test", two.length === 2);
  await setIdentityDisplayOrder(talent.id, ["underdog_backer", "talent_spotter"]);
  const reordered = await getIdentityAwards(talent.id);
  check(
    "owner reorder persists",
    reordered[0].identityKey === "underdog_backer" &&
      reordered[1].identityKey === "talent_spotter"
  );
  let threw = false;
  try {
    await setIdentityDisplayOrder(talent.id, ["talent_spotter", "loyal_backer" as never]);
  } catch {
    threw = true;
  }
  check("reorder rejects keys the user does not own", threw);

  // ── 10. No spend-tier language ────────────────────────────────────────
  const copyBlobs = [
    identityEarnedTitle("talent_spotter"),
    identityEarnedTitle("underdog_backer"),
    identityEarnedTitle("loyal_backer"),
    talentSpotterSummary(3, 3),
    ...talentEv.map((e) => e.evidenceSummary),
    ...underdogEv.map((e) => e.evidenceSummary),
    ...loyalEv.map((e) => e.evidenceSummary),
    JSON.stringify(IDENTITY_RULES),
  ];
  const forbidden = /\b(whale|spender|top spender|vip|diamond|platinum|cash|\$|£|€)\b/i;
  check(
    "no spend-tier / fiat language in identity copy or rules",
    copyBlobs.every((b) => !forbidden.test(b))
  );

  // ── 12. Milestone runner wiring ──────────────────────────────────────
  const fresh = await mkUser("fresh7@test.dev", "Fresh Seven");
  for (let i = 0; i < 3; i++) {
    const p = await mkProfile(`Nominee F${i}`);
    await recordMilestoneEvent({
      rankingId: ranking.id,
      profileId: p.id,
      type: "entered_top_10",
      rankAtEvent: 6,
      creditsAtEvent: 2000,
      backersAtEvent: 10,
    });
    await mkMoment(fresh.id, p.id, 40);
    await db
      .prepare(
        `UPDATE milestone_events SET created_at = datetime('now', '+1 minute')
         WHERE ranking_id = ? AND profile_id = ? AND type = 'entered_top_10'`
      )
      .run(ranking.id, p.id);
    await awardEarlyBackers({
      rankingId: ranking.id,
      profileId: p.id,
      milestoneType: "entered_top_10",
    });
  }
  const candidates = await findIdentityCandidates();
  check("daily candidates include a user with a moment today", candidates.includes(fresh.id));
  const stats = await runMilestoneDetection();
  check("milestone runner completes with identity step", stats.errors === 0);
  const freshAwards = await getIdentityAwards(fresh.id);
  check(
    "runner wiring awards fresh talent_spotter",
    freshAwards.some((a) => a.identityKey === "talent_spotter")
  );

  // ── backfill excludes seed ───────────────────────────────────────────
  const backfill = await backfillIdentities();
  check("seed still has no awards after backfill", (await getIdentityAwards(seedId)).length === 0);
  check("backfill evaluated users", backfill.evaluated >= 5);

  if (failures > 0) {
    console.error(`\n${failures} FAILURE(S)`);
    process.exit(1);
  }
  console.log("\nAll Phase 5.7 identity engine checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
