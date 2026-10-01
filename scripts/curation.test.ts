// Admin homepage curation regression suite.
//
// Run: DATA_DIR=$(mktemp -d) npx tsx scripts/curation.test.ts
// (or: npm run test:curation — the script sets its own temp DATA_DIR)
//
// Covers:
//   A. CRUD: set/get round-trip preserves admin position order; clear
//      empties a surface; unknown surface throws.
//   B. Validation: per-surface max picks enforced (trending 3, rising 6);
//      duplicates deduped (first wins); non-public rankings rejected;
//      a failed save never half-applies.
//   C. Read path: getManualCuratedRankings resolves public rankings in
//      order and silently skips picks that went non-public.
//   D. Surfaces are independent.
//   E. Manual-first: listRisingNow puts curated picks first (in admin
//      order) and never duplicates them in the automatic fill.
import { ensureMigrated } from "../src/db/schema";
import { db } from "../src/db/client";
import { createRanking } from "../src/db/rankings";
import { createUser } from "../src/db/users";
import { createProfile } from "../src/db/profiles";
import {
  getManualCuration,
  setManualCuration,
  clearManualCuration,
  getManualCuratedRankings,
  CURATION_SURFACES,
} from "../src/db/curation";
import { listRisingNow } from "../src/db/homepage";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
async function throws(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
}

async function main() {
  await ensureMigrated();
  const creator = await createUser({
    email: "curation-creator@example.com",
    passwordHash: "x",
    name: "Curation Creator",
  });
  const makeRanking = (title: string) =>
    createRanking({
      title,
      country: "United Kingdom",
      city: "London",
      description: `${title} description`,
      createdBy: creator.id,
    });

  console.log("A. CRUD");
  check("empty by default (trending)", (await getManualCuration("trending")).length === 0);
  check("empty by default (rising)", (await getManualCuration("rising")).length === 0);

  const r1 = await makeRanking("Curation Test Alpha");
  const r2 = await makeRanking("Curation Test Beta");
  const r3 = await makeRanking("Curation Test Gamma");
  const r4 = await makeRanking("Curation Test Delta");

  await setManualCuration("trending", [r2.id, r1.id]);
  const picks = await getManualCuration("trending");
  check(
    "set/get preserves position order",
    picks.length === 2 && picks[0].rankingId === r2.id && picks[0].position === 1 && picks[1].rankingId === r1.id,
    JSON.stringify(picks),
  );
  await clearManualCuration("trending");
  check("clear empties the surface", (await getManualCuration("trending")).length === 0);
  check("unknown surface throws", await throws(() => setManualCuration("nope" as never, [])));

  console.log("B. Validation");
  check(
    "trending max 3 enforced",
    await throws(() => setManualCuration("trending", [r1.id, r2.id, r3.id, r4.id])),
  );
  await setManualCuration("trending", [r1.id, r2.id, r3.id]);
  check("trending exactly 3 ok", (await getManualCuration("trending")).length === 3);
  await clearManualCuration("trending");
  // need 7 ids for the rising overflow test
  const r5 = await makeRanking("Curation Test Epsilon");
  const r6 = await makeRanking("Curation Test Zeta");
  const r7 = await makeRanking("Curation Test Eta");
  check(
    "rising max 6 enforced",
    await throws(() => setManualCuration("rising", [r1.id, r2.id, r3.id, r4.id, r5.id, r6.id, r7.id])),
  );
  check("rising max constant is 6", CURATION_SURFACES.rising.maxPicks === 6);
  check("trending max constant is 3", CURATION_SURFACES.trending.maxPicks === 3);

  await setManualCuration("rising", [r1.id, r1.id, " ", r2.id]);
  const deduped = await getManualCuration("rising");
  check(
    "duplicates/empties deduped (first wins)",
    deduped.length === 2 && deduped[0].rankingId === r1.id && deduped[1].rankingId === r2.id,
    JSON.stringify(deduped),
  );
  await clearManualCuration("rising");

  // Non-public ranking must be rejected, and the failed save must not
  // half-apply (surface stays exactly as before).
  await setManualCuration("trending", [r1.id]);
  await db.prepare("UPDATE rankings SET is_hidden = 1 WHERE id = ?").run(r2.id);
  check(
    "hidden ranking rejected",
    await throws(() => setManualCuration("trending", [r1.id, r2.id])),
  );
  const afterFailed = await getManualCuration("trending");
  check(
    "failed save leaves surface untouched",
    afterFailed.length === 1 && afterFailed[0].rankingId === r1.id,
    JSON.stringify(afterFailed),
  );
  await db.prepare("UPDATE rankings SET is_hidden = 0 WHERE id = ?").run(r2.id);
  await clearManualCuration("trending");

  console.log("C. Resolved read path");
  await setManualCuration("trending", [r3.id, r1.id]);
  const resolved = await getManualCuratedRankings("trending");
  check(
    "resolves to public rankings in order",
    resolved.length === 2 && resolved[0].id === r3.id && resolved[1].id === r1.id,
  );
  await db.prepare("UPDATE rankings SET is_hidden = 1 WHERE id = ?").run(r3.id);
  const skipped = await getManualCuratedRankings("trending");
  check(
    "silently skips picks that went non-public",
    skipped.length === 1 && skipped[0].id === r1.id,
    JSON.stringify(skipped.map((r) => r.id)),
  );
  check(
    "raw picks still visible to admin",
    (await getManualCuration("trending")).length === 2,
  );
  await db.prepare("UPDATE rankings SET is_hidden = 0 WHERE id = ?").run(r3.id);
  await clearManualCuration("trending");

  console.log("D. Surface independence");
  await setManualCuration("trending", [r1.id]);
  await setManualCuration("rising", [r2.id, r3.id]);
  check(
    "trending unaffected by rising",
    (await getManualCuration("trending")).length === 1,
  );
  check(
    "rising holds its own picks",
    (await getManualCuration("rising")).length === 2,
  );
  await clearManualCuration("trending");
  await clearManualCuration("rising");

  console.log("E. Manual-first in listRisingNow");
  // Give r4 real organic velocity so the automatic logic would rank it
  // first on its own; curate r1 (zero velocity) and assert manual-first
  // ordering with no duplication.
  const user = await createUser({
    email: "curation-test@example.com",
    passwordHash: "x",
    name: "Curation Test",
  });
  const profile = await createProfile({
    rankingId: r4.id,
    name: "Curation Nominee",
    addedBy: user.id,
  });
  await db
    .prepare(
      `INSERT INTO likes (id, ranking_id, profile_id, user_id, count, created_at, like_source)
       VALUES (?, ?, ?, ?, 5, datetime('now'), 'organic')`,
    )
    .run(`like-curation-${Date.now()}`, r4.id, profile.id, user.id);
  // Baseline: pure automatic order BEFORE any curation is set.
  const baselineIds = (await listRisingNow(6)).map((r) => r.ranking.id);
  await setManualCuration("rising", [r1.id]);
  const rows = await listRisingNow(6);
  check("manual pick is first", rows.length > 0 && rows[0].ranking.id === r1.id,
    rows.length ? rows[0].ranking.id : "no rows");
  const ids = rows.map((r) => r.ranking.id);
  check("no duplicated rankings", new Set(ids).size === ids.length, ids.join(","));
  check(
    "automatic fill still includes the velocity ranking",
    ids.includes(r4.id),
    ids.join(","),
  );
  await clearManualCuration("rising");

  // No curation at all → the exact same automatic order as the baseline
  // (i.e. wiring in manual-first did not change auto behaviour).
  const afterIds = (await listRisingNow(6)).map((r) => r.ranking.id);
  check(
    "no curation → automatic order unchanged",
    JSON.stringify(afterIds) === JSON.stringify(baselineIds),
    `baseline=${baselineIds.join(",")} after=${afterIds.join(",")}`,
  );

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
