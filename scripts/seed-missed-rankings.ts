// Backfill editorial seed likes for rankings missed by fandom_launch_v1.
//
// Invariant (user decision 2026-10-01): every publicly visible ranking card
// must show a non-zero like count. fandom_launch_v1 seeded the mandatory
// fandom rankings; this backfill covers any other eligible ranking that has
// nominees but zero seed likes (e.g. rankings created or populated later).
//
// Eligibility (mirrors the fandom seed guarantees):
//   - system-generated (never user-created rankings)
//   - publicly visible (not hidden / deleted / archived)
//   - has at least one nominee
//   - has zero seed likes so far
// Deterministic distribution via seedCountFor(); attributed to the RepHear
// Team system account (team@rephear.com) with like_source = 'seed'; never
// creates seed Support; never runs on server boot.
//
// Re-runnable: each apply run records its own version
// (seed_backfill_<yyyymmdd>). Rankings already seeded are excluded by the
// eligibility query, and INSERT … ON CONFLICT DO NOTHING keeps the first
// written count stable even if the hash changes between run dates.
//
// Usage:
//   npx tsx scripts/seed-missed-rankings.ts --preview   # dry run (read-only, default)
//   npx tsx scripts/seed-missed-rankings.ts --apply     # write seed likes
import { randomUUID } from "node:crypto";
import { ensureMigrated } from "../src/db/schema";
import { db, rawClient } from "../src/db/client";
import { seedCountFor } from "../src/db/seedFandomLaunchLikes";

const TEAM_EMAIL = "team@rephear.com";

function runVersion(): string {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `seed_backfill_${ymd}`;
}

interface EligibleRow {
  ranking_id: string;
  ranking_title: string;
  profile_id: string;
}

async function findEligible(): Promise<EligibleRow[]> {
  // rawClient (not the `db` wrapper): preview must not trigger
  // ensureMigrated()/seeders — strictly SELECT, zero writes.
  const r = await rawClient.execute(
    `SELECT r.id AS ranking_id, r.title AS ranking_title, p.id AS profile_id
     FROM rankings r
     JOIN profiles p ON p.ranking_id = r.id AND p.deleted_at IS NULL
     WHERE r.deleted_at IS NULL
       AND COALESCE(r.is_hidden, 0) = 0
       AND COALESCE(r.is_archived, 0) = 0
       AND COALESCE(r.is_system_generated, 0) = 1
       AND NOT EXISTS (
         SELECT 1 FROM likes l
         WHERE l.ranking_id = r.id AND l.like_source = 'seed'
       )
     ORDER BY r.created_at ASC, p.created_at ASC`
  );
  return r.rows as unknown as EligibleRow[];
}

async function main() {
  const apply = process.argv.includes("--apply");
  // Preview is strictly read-only: no migrations, no seeders, no writes.
  // Apply needs the schema guaranteed (seed_like_runs, like_source), so migrate first.
  if (apply) await ensureMigrated();
  const version = runVersion();
  const rows = await findEligible();

  const posByRanking = new Map<string, number>();
  const titles = new Map<string, string>();
  let projectedTotal = 0;
  for (const row of rows) {
    const pos = posByRanking.get(row.ranking_id) ?? 0;
    posByRanking.set(row.ranking_id, pos + 1);
    titles.set(row.ranking_id, row.ranking_title);
    projectedTotal += seedCountFor(row.ranking_id, row.profile_id, pos, version);
  }

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          mode: "preview",
          version,
          eligibleRankings: posByRanking.size,
          eligibleNominees: rows.length,
          projectedTotal,
          rankings: [...titles.entries()].map(([id, title]) => ({ id, title })),
        },
        null,
        2
      )
    );
    return;
  }

  const team = (await db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(TEAM_EMAIL)) as unknown as { id: string } | undefined;
  if (!team) throw new Error(`seed: system account ${TEAM_EMAIL} not found`);
  const teamOrganicLikes = (
    (await db
      .prepare(
        "SELECT COUNT(*) AS c FROM likes WHERE user_id = ? AND like_source = 'organic'"
      )
      .get(team.id)) as unknown as { c: number }
  ).c;
  if (teamOrganicLikes > 0)
    throw new Error(
      `seed: ${TEAM_EMAIL} holds ${teamOrganicLikes} organic likes — refusing to mix attribution`
    );

  const insertStmt = db.prepare(
    `INSERT INTO likes (id, ranking_id, profile_id, user_id, created_at, count, like_source)
     VALUES (?, ?, ?, ?, datetime('now'), ?, 'seed')
     ON CONFLICT (ranking_id, profile_id, user_id) DO NOTHING`
  );

  let nomineesSeeded = 0;
  let totalSeedLikes = 0;
  const seenRankings = new Set<string>();
  const pos = new Map<string, number>();
  for (const row of rows) {
    const p = pos.get(row.ranking_id) ?? 0;
    pos.set(row.ranking_id, p + 1);
    const count = seedCountFor(row.ranking_id, row.profile_id, p, version);
    const res = await insertStmt.run(randomUUID(), row.ranking_id, row.profile_id, team.id, count);
    if (Number(res.changes) > 0) {
      seenRankings.add(row.ranking_id);
      nomineesSeeded++;
      totalSeedLikes += count;
    }
  }

  await db
    .prepare(
      `INSERT INTO seed_like_runs (version, rankings_count, nominees_count, total_seed_likes, notes)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      version,
      seenRankings.size,
      nomineesSeeded,
      totalSeedLikes,
      "Backfill seed likes for eligible public rankings missed by fandom_launch_v1 (user decision 2026-10-01: every public ranking card must show a non-zero like count). Deterministic distribution; attributed to team@rephear.com; like_source='seed'."
    );

  console.log(
    JSON.stringify(
      { mode: "apply", version, rankingsSeeded: seenRankings.size, nomineesSeeded, totalSeedLikes },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error("seed-missed-rankings failed:", e);
  process.exit(1);
});
