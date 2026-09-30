// Seed Likes Policy implementation — fandom launch seed dataset.
//
// Version: fandom_launch_v1
//
// What it does:
//   Gives the newly created mandatory fandom rankings (Anime / Manga /
//   Gaming / Cosplay / Digital Creators) an editorial cold-start baseline
//   of Seed Likes so legitimate new content doesn't visually appear
//   abandoned at 0.
//
// Hard guarantees (§3, §4, §12-§19):
//   - Deterministic: sha256(version | ranking_id | profile_id) → count.
//     Same version always produces the same baseline. No mechanical
//     patterns (no 100/100/100, no 101/102/103).
//   - Idempotent: seed_like_runs records the version; a second run is a
//     no-op. INSERT … ON CONFLICT DO NOTHING as belt-and-braces.
//   - NEVER runs on server boot. Explicit editorial operation only:
//     `npx tsx scripts/seed-fandom-likes.ts` or the admin action.
//   - Zero fake users: all seed rows are attributed to the RepHear Team
//     system account (team@rephear.com) with like_source = 'seed'.
//   - Never seeds user-created rankings (is_system_generated = 0 excluded).
//   - Content first: only rankings that already have nominees are seeded.
//     The 42 people/creator rankings with no verified nominees yet are
//     skipped automatically (seeded only after real nominees exist, §17).
//   - No fake temporal activity: created_at is the honest run timestamp;
//     Rising/Trending and analytics read organic likes only, so seed rows
//     can never manufacture "X people voted today".
//   - Seed Support is never created (likes only).

import { createHash, randomUUID } from "crypto";
import { db } from "./client";

export const FANDOM_SEED_VERSION = "fandom_launch_v1";

// Top-level taxonomy slugs covered by the mandatory fandom dataset.
const FANDOM_CATEGORY_SLUGS = ["anime", "manga", "gaming", "cosplay", "digital-creators"];

// RepHear Team system account — the editorial attribution for seed rows.
// Must exist and must hold no organic likes (verified at seed time).
const TEAM_EMAIL = "team@rephear.com";

export interface FandomSeedResult {
  version: string;
  skipped: boolean;
  reason?: string;
  rankingsSeeded: number;
  nomineesSeeded: number;
  totalSeedLikes: number;
}

// Deterministic editorial distribution: position-weighted base (earlier
// nominees start slightly higher) plus hash jitter for natural variation.
// Range ≈ 50–288, never a flat or sequential pattern.
export function seedCountFor(
  rankingId: string,
  profileId: string,
  position: number,
  version: string = FANDOM_SEED_VERSION
): number {
  const h = createHash("sha256")
    .update(`${version}|${rankingId}|${profileId}`)
    .digest();
  const jitter = h.readUInt32BE(0) % 89; // 0–88
  const base = Math.max(50, 200 - position * 6);
  return base + jitter;
}

export async function seedFandomLaunchLikes(): Promise<FandomSeedResult> {
  const version = FANDOM_SEED_VERSION;

  // ── Idempotency gate ──────────────────────────────────────────────
  const prior = (await db
    .prepare("SELECT version FROM seed_like_runs WHERE version = ?")
    .get(version)) as unknown as { version: string } | undefined;
  if (prior) {
    return {
      version,
      skipped: true,
      reason: `version ${version} already applied`,
      rankingsSeeded: 0,
      nomineesSeeded: 0,
      totalSeedLikes: 0,
    };
  }

  // ── Editorial attribution (no fake users) ─────────────────────────
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

  // ── Eligible rankings ─────────────────────────────────────────────
  // System-created, in the five fandom categories, visible, and already
  // populated with nominees. User-created rankings are never eligible.
  const placeholders = FANDOM_CATEGORY_SLUGS.map(() => "?").join(",");
  const rankings = (await db
    .prepare(
      `SELECT r.id
       FROM rankings r
       JOIN categories c ON c.id = r.category_id
       WHERE r.deleted_at IS NULL
         AND COALESCE(r.is_hidden, 0) = 0
         AND COALESCE(r.is_system_generated, 0) = 1
         AND c.slug IN (${placeholders})
         AND EXISTS (
           SELECT 1 FROM profiles p
           WHERE p.ranking_id = r.id AND p.deleted_at IS NULL
         )
       ORDER BY r.created_at ASC`
    )
    .all(...FANDOM_CATEGORY_SLUGS)) as unknown as { id: string }[];

  let nomineesSeeded = 0;
  let totalSeedLikes = 0;
  let rankingsSeeded = 0;

  const insertStmt = db.prepare(
    `INSERT INTO likes (id, ranking_id, profile_id, user_id, created_at, count, like_source)
     VALUES (?, ?, ?, ?, datetime('now'), ?, 'seed')
     ON CONFLICT (ranking_id, profile_id, user_id) DO NOTHING`
  );

  for (const ranking of rankings) {
    const nominees = (await db
      .prepare(
        `SELECT id FROM profiles
         WHERE ranking_id = ? AND deleted_at IS NULL
         ORDER BY created_at ASC`
      )
      .all(ranking.id)) as unknown as { id: string }[];
    if (nominees.length === 0) continue;

    let seededHere = 0;
    for (let position = 0; position < nominees.length; position++) {
      const nominee = nominees[position];
      const count = seedCountFor(ranking.id, nominee.id, position, version);
      const res = await insertStmt.run(
        randomUUID(),
        ranking.id,
        nominee.id,
        team.id,
        count
      );
      if (Number(res.changes) > 0) {
        seededHere++;
        nomineesSeeded++;
        totalSeedLikes += count;
      }
    }
    if (seededHere > 0) rankingsSeeded++;
  }

  // ── Record the run (completes the idempotency contract) ───────────
  await db
    .prepare(
      `INSERT INTO seed_like_runs (version, rankings_count, nominees_count, total_seed_likes, notes)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      version,
      rankingsSeeded,
      nomineesSeeded,
      totalSeedLikes,
      "Editorial cold-start baseline for the mandatory fandom rankings (anime/manga/gaming/cosplay/digital-creators). Deterministic distribution; attributed to team@rephear.com; like_source='seed'."
    );

  return {
    version,
    skipped: false,
    rankingsSeeded,
    nomineesSeeded,
    totalSeedLikes,
  };
}

// Dry-run: what WOULD be seeded, without writing anything.
export async function previewFandomSeed(): Promise<{
  eligibleRankings: number;
  eligibleNominees: number;
  projectedTotal: number;
  alreadyApplied: boolean;
}> {
  const prior = (await db
    .prepare("SELECT version FROM seed_like_runs WHERE version = ?")
    .get(FANDOM_SEED_VERSION)) as unknown as { version: string } | undefined;
  const placeholders = FANDOM_CATEGORY_SLUGS.map(() => "?").join(",");
  const rows = (await db
    .prepare(
      `SELECT r.id AS ranking_id, p.id AS profile_id
       FROM rankings r
       JOIN categories c ON c.id = r.category_id
       JOIN profiles p ON p.ranking_id = r.id AND p.deleted_at IS NULL
       WHERE r.deleted_at IS NULL
         AND COALESCE(r.is_hidden, 0) = 0
         AND COALESCE(r.is_system_generated, 0) = 1
         AND c.slug IN (${placeholders})
       ORDER BY r.created_at ASC, p.created_at ASC`
    )
    .all(...FANDOM_CATEGORY_SLUGS)) as unknown as {
    ranking_id: string;
    profile_id: string;
  }[];
  const posByRanking = new Map<string, number>();
  let projectedTotal = 0;
  for (const row of rows) {
    const pos = posByRanking.get(row.ranking_id) ?? 0;
    posByRanking.set(row.ranking_id, pos + 1);
    projectedTotal += seedCountFor(row.ranking_id, row.profile_id, pos);
  }
  return {
    eligibleRankings: posByRanking.size,
    eligibleNominees: rows.length,
    projectedTotal,
    alreadyApplied: !!prior,
  };
}
