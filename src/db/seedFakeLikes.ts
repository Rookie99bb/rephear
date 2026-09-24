import { db } from "./client";
import { newId } from "@/lib/id";

// Cold-start social proof: every nominee in a public ranking gets a
// plausible base of likes so no card ever shows "0 likes" on launch day.
//
// Design notes:
// - Idempotent startup step (wired into ensureMigrated). On every boot it
//   only tops up profiles whose total likes are still below their target;
//   real user likes are never touched or reduced.
// - Likes are spread across a pool of clearly-marked synthetic community
//   accounts (seed_community_01..12) so no single fake user holds an
//   absurd total, and the rows are trivially identifiable in admin.
// - Targets are deliberately clustered and deterministic: each ranking
//   derives one base in [230, 300] from its id, each nominee jitters ±30
//   around it (floor 205), so nominees in the same ranking stay in the
//   same ballpark and repeated boots never inflate totals.

const SEED_USER_COUNT = 12;
const SEED_USER_PREFIX = "seed_community_";

function seedUserIds(): string[] {
  return Array.from(
    { length: SEED_USER_COUNT },
    (_, i) => `${SEED_USER_PREFIX}${String(i + 1).padStart(2, "0")}`
  );
}

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic per-profile target: the same profile always rolls the same
// target, so repeated startups never ratchet totals upward. Each ranking
// still gets one shared base in [230, 300] (derived from the ranking id)
// with ±30 per-nominee jitter (floor 205), keeping nominees in the same
// ranking in the same ballpark.
function targetForProfile(rankingId: string, profileId: string): number {
  const base = 230 + Math.floor(mulberry32(fnv1a(`base:${rankingId}`))() * 71);
  const rng = mulberry32(fnv1a(`jitter:${profileId}`));
  const jitter = Math.floor(rng() * 61) - 30; // -30..+30
  return Math.max(205, base + jitter);
}

export async function seedFakeLikes(): Promise<void> {
  const userIds = seedUserIds();

  // 1. Make sure the synthetic accounts exist.
  for (const uid of userIds) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO users (id, email, password_hash, name, is_admin)
         VALUES (?, ?, '', ?, 0)`
      )
      .run(uid, `${uid}@seed.rephear.local`, "RepHear Community");
  }

  // 2. One grouped query finds every profile still below its target —
  // then ALL top-up rows are written in a handful of batched multi-row
  // INSERTs. This matters because builds (local and on Render) run
  // migrations too, and Render's build hits the remote Turso database:
  // ~20k individual round trips would time out the build, ~100
  // batched statements take seconds.
  const rows = (await db
    .prepare(
      `SELECT p.id AS pid, p.ranking_id AS rid, COALESCE(SUM(l.count), 0) AS c
       FROM profiles p
       JOIN rankings r ON r.id = p.ranking_id
       LEFT JOIN likes l ON l.profile_id = p.id AND l.ranking_id = p.ranking_id
       WHERE p.deleted_at IS NULL AND r.is_hidden = 0 AND r.deleted_at IS NULL
       GROUP BY p.id`
    )
    .all()) as unknown as { pid: string; rid: string; c: number }[];

  const tuples: [string, string, string, string, number][] = [];
  for (const row of rows) {
    const target = targetForProfile(row.rid, row.pid);
    let remaining = target - row.c;
    if (remaining <= 0) continue;
    // Spread the deficit across the seed accounts so each row stays small.
    let ui = Math.floor(Math.random() * userIds.length);
    while (remaining > 0) {
      const chunk = Math.min(remaining, 5 + Math.floor(Math.random() * 21)); // 5..25
      tuples.push([newId(), row.rid, row.pid, userIds[ui % userIds.length], chunk]);
      remaining -= chunk;
      ui++;
    }
  }

  const BATCH = 200;
  for (let i = 0; i < tuples.length; i += BATCH) {
    const batch = tuples.slice(i, i + BATCH);
    const placeholders = batch.map(() => "(?, ?, ?, ?, ?)").join(", ");
    const args = batch.flat();
    await db
      .prepare(
        `INSERT INTO likes (id, ranking_id, profile_id, user_id, count)
         VALUES ${placeholders}
         ON CONFLICT (ranking_id, profile_id, user_id)
         DO UPDATE SET count = count + excluded.count`
      )
      .run(...args);
  }
}
