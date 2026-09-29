// Smoke test for seedFandomRankings + pruneLegacyRankings interaction.
// Runs against a scratch local SQLite DB (DATA_DIR), never production.
import { db } from "@/db/client";
import { ensureMigrated } from "@/db/schema";
import { FANDOM_RANKING_SLUGS, seedFandomRankings } from "@/db/fandomRankings";

async function main() {
  // Full migration chain on a fresh DB (includes all seeds + prune).
  await ensureMigrated();

  const check = async (label: string) => {
    const rows = (await db
      .prepare(
        `SELECT slug, title FROM rankings WHERE slug IN (${FANDOM_RANKING_SLUGS.map(
          () => "?"
        ).join(",")}) AND deleted_at IS NULL`
      )
      .all(...FANDOM_RANKING_SLUGS)) as { slug: string; title: string }[];
    console.log(
      `${label}: ${rows.length}/${FANDOM_RANKING_SLUGS.length} fandom rankings live`
    );
    const missing = FANDOM_RANKING_SLUGS.filter(
      (s) => !rows.some((r) => r.slug === s)
    );
    if (missing.length) console.log("  MISSING:", missing.join(", "));
    return rows.length;
  };

  const n1 = await check("after ensureMigrated");

  // Idempotency: run the seed again, count must not change.
  await seedFandomRankings();
  const n2 = await check("after re-run seedFandomRankings");

  // Categories resolve.
  const cats = (await db
    .prepare(
      `SELECT slug FROM categories WHERE slug IN ('anime','gaming','tabletop-tcg-roleplaying','cosplay','university-societies')`
    )
    .all()) as { slug: string }[];
  console.log("categories present:", cats.map((c) => c.slug).join(", "));

  // No nominees were created by the seed.
  const nomCount = (
    (await db
      .prepare(
        `SELECT COUNT(*) AS c FROM profiles WHERE ranking_id IN (SELECT id FROM rankings WHERE slug IN (${FANDOM_RANKING_SLUGS.map(
          () => "?"
        ).join(",")}))`
      )
      .get(...FANDOM_RANKING_SLUGS)) as { c: number }
  ).c;
  console.log("nominees on fandom rankings:", nomCount);

  if (n1 === FANDOM_RANKING_SLUGS.length && n2 === n1 && nomCount === 0) {
    console.log("SMOKE PASS");
  } else {
    console.log("SMOKE FAIL");
    process.exit(1);
  }
  process.exit(0);
}

main();
