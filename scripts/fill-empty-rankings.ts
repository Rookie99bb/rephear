// Fill the 42 empty public rankings with researched real-person nominees.
// Usage:
//   npx tsx scripts/fill-empty-rankings.ts            # apply (idempotent)
//   npx tsx scripts/fill-empty-rankings.ts --preview  # dry run only
//
// Reads data/empty-rankings-nominees.json (verified research, 2026-10-01,
// user-approved 2026-10-01: write all 239 incl. flagged entries; wave 2
// continues separately for shortfalls).
//
// Rules:
// - Idempotent: a nominee already present (UNIQUE ranking_id + name NOCASE)
//   is skipped, never duplicated.
// - The two duplicated titles ("Best Cosplay Photographer",
//   "Best Cosplay Video Creator") are disambiguated by the category slug
//   carried in the JSON (cosplay vs digital-creators).
// - NEVER deletes, NEVER updates existing rows, NEVER touches
//   likes / support / rankings / covers.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ensureMigrated } from "../src/db/schema";
import { db } from "../src/db/client";
import {
  createProfile,
  findNomineeByRankingAndName,
} from "../src/db/profiles";

interface ResearchNominee {
  name: string;
  bio: string;
  profile_url: string;
  platform: string;
  corroborating_url: string;
  region: string;
}
interface ResearchRanking {
  title: string;
  category: string;
  nominees: ResearchNominee[];
  shortfall: number;
  shortfall_reason?: string;
}

async function findRankingId(
  title: string,
  categorySlug: string
): Promise<{ id: string; slug: string | null } | null> {
  const rows = (await db
    .prepare(
      `SELECT r.id AS id, c.slug AS slug
       FROM rankings r LEFT JOIN categories c ON c.id = r.category_id
       WHERE r.title = ? AND r.is_hidden = 0 AND r.deleted_at IS NULL`
    )
    .all(title)) as Array<{ id: string; slug: string | null }>;
  if (rows.length === 0) return null;
  if (rows.length === 1) return rows[0];
  const match = rows.find((r) => r.slug === categorySlug);
  return match ?? null;
}

async function main() {
  const preview = process.argv.includes("--preview");
  await ensureMigrated();

  const team = (await db
    .prepare("SELECT id FROM users WHERE email = 'team@rephear.com' LIMIT 1")
    .get()) as unknown as { id: string } | undefined;
  if (!team) throw new Error("team@rephear.com user not found");

  const data = JSON.parse(
    readFileSync(
      join(process.cwd(), "data", "empty-rankings-nominees.json"),
      "utf8"
    )
  ) as { rankings: ResearchRanking[] };

  const perRanking: Array<{
    title: string;
    ranking_id: string | null;
    category: string;
    to_insert: number;
    skipped_existing: number;
    shortfall: number;
  }> = [];
  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const rr of data.rankings) {
    const found = await findRankingId(rr.title, rr.category);
    if (!found) {
      errors.push(`ranking not found (public, non-hidden): ${rr.title}`);
      perRanking.push({
        title: rr.title,
        ranking_id: null,
        category: rr.category,
        to_insert: 0,
        skipped_existing: 0,
        shortfall: rr.shortfall,
      });
      continue;
    }
    let toInsert = 0;
    let skippedExisting = 0;
    for (const n of rr.nominees) {
      const name = n.name.trim();
      if (!name) continue;
      const existing = await findNomineeByRankingAndName(found.id, name);
      if (existing) {
        skippedExisting++;
        continue;
      }
      if (preview) {
        toInsert++;
        continue;
      }
      await createProfile({
        rankingId: found.id,
        name,
        bio: (n.bio ?? "").trim(),
        region: (n.region ?? "").trim(),
        addedBy: team.id,
      });
      toInsert++;
    }
    inserted += preview ? 0 : toInsert;
    skipped += skippedExisting;
    perRanking.push({
      title: rr.title,
      ranking_id: found.id,
      category: rr.category,
      to_insert: toInsert,
      skipped_existing: skippedExisting,
      shortfall: rr.shortfall,
    });
  }

  console.log(
    JSON.stringify(
      {
        mode: preview ? "preview" : "apply",
        rankings_in_file: data.rankings.length,
        rankings_matched: perRanking.filter((r) => r.ranking_id).length,
        nominees_inserted: preview
          ? perRanking.reduce((a, r) => a + r.to_insert, 0)
          : inserted,
        nominees_skipped_existing: skipped,
        errors,
        per_ranking: perRanking,
      },
      null,
      2
    )
  );
  if (errors.length > 0) process.exitCode = 2;
}

main().catch((e) => {
  console.error("fill-empty-rankings failed:", e);
  process.exit(1);
});
