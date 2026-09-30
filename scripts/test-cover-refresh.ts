// Weekly ranking cover refresh — dev/test verification.
//
// Runs against a throwaway local SQLite file — NEVER production.
// Usage: DATA_DIR=$(mktemp -d /tmp/rephear-covers.XXXXXX) npx tsx scripts/test-cover-refresh.ts
//
// Covers:
//   A. Migrations add cover columns + is_global + refresh log table.
//   B. is_global heuristic backfill ("Best Anime of All Time" -> global).
//   C. Refresh assigns covers: nominee photo preferred, category
//      fallback when no usable nominee photo exists.
//   D. Manual (locked) covers are never touched.
//   E. Second run with no changes logs "unchanged" (no churn).
//   F. Every check writes a row to ranking_cover_refresh_log.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "rephear-covers-"));

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
  const { ensureMigrated } = await import("../src/db/schema");
  await ensureMigrated();
  await ensureMigrated(); // idempotent

  const rankings = await import("../src/db/rankings");
  const { createRanking, findRankingById, setRankingCover, setCoverLocked } = rankings;
  const { createProfile } = await import("../src/db/profiles");
  const { findOrCreateCategory } = await import("../src/db/categories");
  const { weeklyRankingCoverRefresh } = await import("../src/db/rankingCoverRefresh");
  const { getCoverRefreshHistory } = rankings;

  // Test user for created_by.
  const { createUser } = await import("../src/db/users");
  const user = await createUser({
    email: `cover-test-${Date.now()}@example.com`,
    passwordHash: "x",
    name: "Cover Test",
  });

  const category = await findOrCreateCategory({
    name: "Anime",
    slug: "anime",
    description: "Anime rankings",
  });

  // A. Global-title ranking (heuristic backfill target).
  const globalRanking = await createRanking({
    title: "Best Anime of All Time",
    country: "United Kingdom",
    city: "London",
    description: "The definitive list.",
    createdBy: user.id,
    slug: `best-anime-all-time-${Date.now()}`,
    categoryId: category.id,
  });
  // B. Local ranking with a self-hosted nominee photo.
  const localRanking = await createRanking({
    title: "London Cosplay Meetup Test",
    country: "United Kingdom",
    city: "London",
    description: "Local test ranking.",
    createdBy: user.id,
    slug: `london-cosplay-test-${Date.now()}`,
  });
  await createProfile({
    rankingId: localRanking.id,
    name: "Test Cosplayer",
    bio: "",
    photoUrl: "/covers/categories/cosplay-card.webp",
    addedBy: user.id,
  });
  // C. Manual (locked) cover — must never be overwritten.
  const manualRanking = await createRanking({
    title: "Manual Cover Test",
    country: "United Kingdom",
    city: "London",
    description: "",
    createdBy: user.id,
    slug: `manual-cover-test-${Date.now()}`,
  });
  await setRankingCover(manualRanking.id, {
    url: "/covers/categories/music-card.webp",
    source: "manual",
    alt: "admin upload",
    status: "manual",
  });

  // B: heuristic backfill runs inside ensureMigrated — re-run it now
  // that the test rankings exist (it's idempotent).
  await ensureMigrated();
  const reloaded = await findRankingById(globalRanking.id);
  check("global-title ranking flagged global by backfill heuristic", reloaded?.isGlobal === true);

  // First refresh run.
  const run1 = await weeklyRankingCoverRefresh();
  console.log(`  run1: checked=${run1.checked} changed=${run1.changed} unchanged=${run1.unchanged} skippedManual=${run1.skippedManual} errors=${run1.errors}`);

  const afterLocal = await findRankingById(localRanking.id);
  check(
    "local ranking got nominee-photo cover",
    afterLocal?.coverImageUrl === "/covers/categories/cosplay-card.webp" &&
      afterLocal?.coverImageSource === "nominee" &&
      afterLocal?.coverImageStatus === "active",
    JSON.stringify({ url: afterLocal?.coverImageUrl, src: afterLocal?.coverImageSource })
  );

  const afterGlobal = await findRankingById(globalRanking.id);
  check(
    "global ranking got category-fallback cover",
    !!afterGlobal?.coverImageUrl &&
      afterGlobal.coverImageUrl.includes("anime-card.webp") &&
      afterGlobal?.coverImageStatus === "active",
    afterGlobal?.coverImageUrl ?? "none"
  );

  const afterManual = await findRankingById(manualRanking.id);
  check(
    "manual cover untouched",
    afterManual?.coverImageUrl === "/covers/categories/music-card.webp" &&
      afterManual?.coverImageStatus === "manual",
    afterManual?.coverImageUrl ?? "none"
  );

  const history = await getCoverRefreshHistory(localRanking.id, 5);
  check("refresh log has entries", history.length > 0, `got ${history.length}`);
  check(
    "log records reason",
    history.some((h) => ["broken_source", "better_candidate", "fallback"].includes(h.reason)),
    history.map((h) => h.reason).join(",")
  );

  // E: second run — no churn.
  const run2 = await weeklyRankingCoverRefresh();
  console.log(`  run2: checked=${run2.checked} changed=${run2.changed} unchanged=${run2.unchanged} skippedManual=${run2.skippedManual} errors=${run2.errors}`);
  const stillLocal = await findRankingById(localRanking.id);
  check(
    "second run keeps existing cover (no churn)",
    stillLocal?.coverImageUrl === afterLocal?.coverImageUrl,
    `${stillLocal?.coverImageUrl} vs ${afterLocal?.coverImageUrl}`
  );
  const history2 = await getCoverRefreshHistory(localRanking.id, 5);
  check("second run logged unchanged", history2.some((h) => h.reason === "unchanged"));

  // D: unlock a manual cover -> weekly job may now refresh it.
  await setCoverLocked(manualRanking.id, false);
  const unlocked = await findRankingById(manualRanking.id);
  check("unlock flips status to pending", unlocked?.coverImageStatus === "pending");

  console.log(failures === 0 ? "\nAll cover-refresh checks passed." : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("FATAL", err);
  process.exit(1);
});
