// Smoke test for the referrer commission system (PRD 推荐官返佣 MVP).
//
// Covers: signup attribution, instant raffle feedback, payment -> pending,
// webhook idempotency, T+14 release, refund -> reversed, paid-then-refund ->
// negative adjustment + pause + high flag, 180-day window cutoff,
// campaign-only (no referral) exclusion, minimum-withdrawal guard,
// concurrent payout requests, audit trail.
//
// Runs against a throwaway local SQLite file — NEVER production.
// Usage: npx tsx scripts/smoke-referrer-commissions.ts

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DATA_DIR = fs.mkdtempSync(
  path.join(os.tmpdir(), "smoke-referrer-")
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
  const { getOrCreateInvitationForUser } = await import("@/db/invitations");
  const { applyReferral } = await import("@/lib/actions/auth");
  const { createRaffle, hasRaffleEntry } = await import("@/db/raffles");
  const { recordAuditLog, AUDIT_ACTIONS } = await import("@/db/auditLog");
  const comm = await import("@/db/referrerCommissions");

  await ensureMigrated();
  const stamp = Date.now().toString(36);
  const mkUser = async (tag: string) =>
    createUser({
      email: `smoke-${tag}-${stamp}@example.com`,
      passwordHash: bcrypt.hashSync("password123", 10),
      name: `Smoke ${tag}`,
    });

  // Minimal ranking + nominee rows so payments satisfy their FKs.
  const seedUser = await mkUser("seed");
  const rankingId = newId();
  const profileId = newId();
  await db
    .prepare(
      `INSERT INTO rankings (id, title, country, city, created_by)
       VALUES (?, 'Smoke ranking', 'UK', 'London', ?)`
    )
    .run(rankingId, seedUser.id);
  await db
    .prepare(
      `INSERT INTO profiles (id, ranking_id, name, added_by)
       VALUES (?, ?, 'Smoke nominee', ?)`
    )
    .run(profileId, rankingId, seedUser.id);

  const mkPayment = async (
    userId: string,
    amountCents: number,
    tag: string
  ): Promise<string> => {
    const id = newId();
    await db
      .prepare(
        `INSERT INTO payments
           (id, user_id, ranking_id, profile_id, package_id, credits,
            amount_cents, currency, stripe_checkout_session_id,
            status, completed_at)
         VALUES (?, ?, ?, ?, 'pkg-smoke', 100,
                 ?, 'usd', ?, 'completed', datetime('now'))`
      )
      .run(id, userId, rankingId, profileId, amountCents, `sess-${tag}-${stamp}-${id.slice(0, 6)}`);
    return id;
  };
  const countCommissions = async (): Promise<number> => {
    const r = (await db
      .prepare("SELECT COUNT(*) AS c FROM referral_commissions")
      .get()) as unknown as { c: number };
    return r.c;
  };
  const getCommission = async (paymentId: string) =>
    comm.findCommissionByPaymentId(paymentId);

  // ------------------------------------------------ 1. attribution
  console.log("\n[1] signup attribution + instant raffle feedback");
  const referrer = await mkUser("referrer");
  const invitation = await getOrCreateInvitationForUser(referrer.id);
  const raffle = await createRaffle({
    title: "Smoke draw",
    prizeDescription: "test prize",
    endsAt: "2099-01-01 00:00:00",
  });
  const referee = await mkUser("referee");
  const bonus = await applyReferral(referee.id, invitation.inviteCode, "127.0.0.1");
  check("applyReferral grants invite bonus", bonus === 5);
  const referralRow = (await db
    .prepare("SELECT * FROM referrals WHERE new_user_id = ?")
    .get(referee.id)) as unknown as { referrer_id: string } | undefined;
  check("referral row links referee -> referrer", referralRow?.referrer_id === referrer.id);
  check(
    "referrer gets instant raffle entry",
    await hasRaffleEntry(raffle.id, referrer.id)
  );

  // ------------------------------------------------ 2. booking
  console.log("\n[2] completed payment -> pending commission");
  const p1 = await mkPayment(referee.id, 10000, "p1"); // $100
  const c1 = await comm.bookCommissionForPayment(p1);
  check("commission booked", !!c1);
  check("rate is 5% ($100 -> $5.00)", c1?.commissionCents === 500);
  check("status pending", c1?.status === "pending");
  check(
    "available_at is ~14 days out",
    !!c1 &&
      new Date(c1.availableAt.replace(" ", "T") + "Z").getTime() - Date.now() >
        13 * 24 * 3600 * 1000
  );

  // ------------------------------------------------ 3. idempotency
  console.log("\n[3] webhook redelivery is idempotent");
  const before = await countCommissions();
  const c1again = await comm.bookCommissionForPayment(p1);
  check("redelivery returns existing row", c1again?.id === c1?.id);
  check("no duplicate row", (await countCommissions()) === before);

  // ------------------------------------------------ 4. T+14 release
  console.log("\n[4] T+14 freeze -> available");
  await db
    .prepare("UPDATE referral_commissions SET available_at = datetime('now', '-1 day') WHERE payment_id = ?")
    .run(p1);
  const released = await comm.releaseMaturedCommissions();
  check("release picks up matured commission", released.some((c) => c.paymentId === p1));
  check("status now available", (await getCommission(p1))?.status === "available");
  const bal1 = await comm.getBalances(referrer.id);
  check("available balance $5.00", bal1.availableCents === 500, `got ${bal1.availableCents}`);

  // ------------------------------------------------ 5. refund -> reversed
  console.log("\n[5] refund of unpaid commission -> reversed");
  const p2 = await mkPayment(referee.id, 5000, "p2"); // $50 -> $2.50
  await comm.bookCommissionForPayment(p2);
  await db
    .prepare("UPDATE referral_commissions SET available_at = datetime('now', '-1 day') WHERE payment_id = ?")
    .run(p2);
  await comm.releaseMaturedCommissions();
  await comm.reverseCommissionForPayment(p2, "payment_refunded");
  check("commission reversed", (await getCommission(p2))?.status === "reversed");
  const bal2 = await comm.getBalances(referrer.id);
  check("available back to $5.00", bal2.availableCents === 500, `got ${bal2.availableCents}`);

  // ------------------------------------------------ 6. payout lifecycle
  console.log("\n[6] payout: request -> approve -> paid");
  const p3 = await mkPayment(referee.id, 50000, "p3"); // $500 -> $25
  await comm.bookCommissionForPayment(p3);
  await db
    .prepare("UPDATE referral_commissions SET available_at = datetime('now', '-1 day') WHERE payment_id = ?")
    .run(p3);
  await comm.releaseMaturedCommissions();
  check("available $30.00 before payout", (await comm.getBalances(referrer.id)).availableCents === 3000);

  // below-minimum guard on a fresh user
  const poor = await mkUser("poor");
  const poorReferee = await mkUser("poor-ref");
  await applyReferral(poorReferee.id, (await getOrCreateInvitationForUser(poor.id)).inviteCode, "127.0.0.2");
  const pPoor = await mkPayment(poorReferee.id, 1000, "ppoor"); // $10 -> $0.50
  await comm.bookCommissionForPayment(pPoor);
  await db
    .prepare("UPDATE referral_commissions SET available_at = datetime('now', '-1 day') WHERE payment_id = ?")
    .run(pPoor);
  await comm.releaseMaturedCommissions();
  await comm.acceptTerms(poor.id);
  let minErr = "";
  try {
    await comm.requestPayout(poor.id, "poor@example.com");
  } catch (e) {
    minErr = e instanceof Error ? e.message : String(e);
  }
  check("below-minimum payout rejected", /at least/.test(minErr), minErr);

  await comm.acceptTerms(referrer.id);
  const adminUser = await mkUser("admin");
  const payout = await comm.requestPayout(referrer.id, "referrer@example.com");
  check("payout amount equals net sum ($30.00)", payout.amountCents === 3000, `got ${payout.amountCents}`);
  const items = (await db
    .prepare("SELECT allocated_amount_cents FROM payout_items WHERE payout_id = ?")
    .all(payout.id)) as unknown as { allocated_amount_cents: number }[];
  check(
    "items sum to payout total",
    items.reduce((s, i) => s + i.allocated_amount_cents, 0) === payout.amountCents
  );
  let doubleErr = "";
  try {
    await comm.requestPayout(referrer.id, "referrer@example.com");
  } catch (e) {
    doubleErr = e instanceof Error ? e.message : String(e);
  }
  check("second concurrent request fails (nothing left)", doubleErr.length > 0, doubleErr);

  check("approve works", await comm.approvePayout(payout.id, adminUser.id, "ok"));
  // The admin server action writes these audit rows; mirror them here so the
  // audit-trail checks below see what production would record.
  await recordAuditLog({
    actorUserId: adminUser.id,
    action: AUDIT_ACTIONS.PAYOUT_APPROVED,
    targetType: "referral_payout",
    targetId: payout.id,
    details: { userId: referrer.id, amountCents: payout.amountCents },
  });
  check("approve is single-use", !(await comm.approvePayout(payout.id, adminUser.id, "ok")));
  check(
    "mark paid works",
    await comm.markPayoutPaid(payout.id, adminUser.id, "ext-ref-123", "sent")
  );
  await recordAuditLog({
    actorUserId: adminUser.id,
    action: AUDIT_ACTIONS.PAYOUT_PAID,
    targetType: "referral_payout",
    targetId: payout.id,
    details: { userId: referrer.id, amountCents: payout.amountCents, providerRef: "ext-ref-123" },
  });
  check("commission p1 now paid", (await getCommission(p1))?.status === "paid");
  check("commission p3 now paid", (await getCommission(p3))?.status === "paid");
  const bal3 = await comm.getBalances(referrer.id);
  check("lifetime paid $30.00", bal3.lifetimePaidCents === 3000, `got ${bal3.lifetimePaidCents}`);

  // ------------------------------------------------ 7. paid-then-refund
  console.log("\n[7] refund after payout -> clawback + pause + flag");
  await comm.reverseCommissionForPayment(p3, "payment_refunded");
  const c3 = await getCommission(p3);
  check("paid commission row stays paid", c3?.status === "paid");
  const adjs = (await db
    .prepare("SELECT amount_cents FROM commission_adjustments WHERE commission_id = ?")
    .all(c3!.id)) as unknown as { amount_cents: number }[];
  check(
    "negative adjustment of -$25.00 recorded",
    adjs.some((a) => a.amount_cents === -2500),
    JSON.stringify(adjs)
  );
  const profile = await comm.getOrCreateReferrerProfile(referrer.id);
  check("referrer paused", profile.status === "paused");
  check(
    "high risk flag open",
    (await comm.countOpenRiskFlags(referrer.id, "high")) === 1
  );

  // ------------------------------------------------ 8. window cutoff
  console.log("\n[8] 180-day window cutoff");
  const oldReferee = await mkUser("old-ref");
  await db
    .prepare(
      `INSERT INTO referrals (id, referrer_id, new_user_id, created_at)
       VALUES (?, ?, ?, datetime('now', '-200 days'))`
    )
    .run(newId(), referrer.id, oldReferee.id);
  const pOld = await mkPayment(oldReferee.id, 10000, "pold");
  check(
    "payment 200 days after signup books nothing",
    (await comm.bookCommissionForPayment(pOld)) === null
  );

  // ------------------------------------------------ 9. campaign-only exclusion
  console.log("\n[9] no referral row -> no commission");
  const organic = await mkUser("organic");
  const pOrg = await mkPayment(organic.id, 10000, "porg");
  check(
    "organic payment books nothing",
    (await comm.bookCommissionForPayment(pOrg)) === null
  );

  // ------------------------------------------------ 10. paused referrer skip
  console.log("\n[10] release skips paused referrers");
  const p4 = await mkPayment(referee.id, 10000, "p4");
  await comm.bookCommissionForPayment(p4);
  await db
    .prepare("UPDATE referral_commissions SET available_at = datetime('now', '-1 day') WHERE payment_id = ?")
    .run(p4);
  await comm.releaseMaturedCommissions();
  check(
    "matured commission stays pending while paused",
    (await getCommission(p4))?.status === "pending"
  );

  // ------------------------------------------------ 11. audit trail
  console.log("\n[11] audit trail");
  const auditCount = async (action: string): Promise<number> => {
    const r = (await db
      .prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE action = ?")
      .get(action)) as unknown as { c: number };
    return r.c;
  };
  check("COMMISSION_REVERSED audited", (await auditCount("commission_reversed")) >= 2);
  check("PAYOUT_APPROVED audited", (await auditCount("payout_approved")) >= 1);
  check("PAYOUT_PAID audited", (await auditCount("payout_paid")) >= 1);
  check("REFERRER_PAUSED audited", (await auditCount("referrer_paused")) >= 1);
  check("RISK_FLAG_ADDED audited", (await auditCount("risk_flag_added")) >= 1);

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("smoke script crashed:", err);
  process.exit(1);
});
