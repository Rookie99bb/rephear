// Scratch migration test: runs ensureMigrated() against a COPY of the
// local DB (DATA_DIR=/tmp/taxonomy-test) and verifies taxonomy v2.
import { ensureMigrated } from "@/db/schema";
import { rawClient } from "@/db/client";

async function main() {
  console.log("Running ensureMigrated on scratch DB...");
  await ensureMigrated();
  console.log("Migration done. Verifying...\n");

  const q = async (sql: string, args: any[] = []) =>
    (await rawClient.execute({ sql, args })).rows as any[];

  // 1. Categories
  const cats = await q(
    "SELECT slug, name FROM categories ORDER BY slug"
  );
  console.log(`categories: ${cats.length}`);
  console.log("  " + cats.map((c) => c.slug).join(", "));

  // 2. Subcategories
  const subs = await q(
    "SELECT c.slug AS cat, s.slug AS sub FROM subcategories s JOIN categories c ON c.id = s.category_id ORDER BY c.slug, s.sort_order"
  );
  console.log(`\nsubcategories: ${subs.length}`);

  // 3. Ranking taxonomy coverage
  const total = await q(
    "SELECT COUNT(*) AS n FROM rankings WHERE is_hidden = 0 AND deleted_at IS NULL"
  );
  const withCat = await q(
    "SELECT COUNT(*) AS n FROM rankings WHERE is_hidden = 0 AND deleted_at IS NULL AND category_id IS NOT NULL"
  );
  const withSub = await q(
    "SELECT COUNT(*) AS n FROM rankings WHERE is_hidden = 0 AND deleted_at IS NULL AND subcategory_id IS NOT NULL"
  );
  const noCat = await q(
    "SELECT title FROM rankings WHERE is_hidden = 0 AND deleted_at IS NULL AND category_id IS NULL LIMIT 20"
  );
  console.log(`\nrankings (active): ${total[0].n}`);
  console.log(`  with category: ${withCat[0].n}, with subcategory: ${withSub[0].n}`);
  console.log(`  without category (sample): ${noCat.map((r) => r.title).join(" | ")}`);

  // 4. Category distribution
  const dist = await q(
    `SELECT c.slug, COUNT(*) AS n FROM rankings r
     JOIN categories c ON c.id = r.category_id
     WHERE r.is_archived = 0 AND r.is_hidden = 0 AND r.deleted_at IS NULL
     GROUP BY c.slug ORDER BY n DESC`
  );
  console.log("\nrankings per category:");
  for (const d of dist) console.log(`  ${d.slug}: ${d.n}`);

  // 5. Scopes
  const scopes = await q(
    `SELECT is_global, COUNT(*) AS n FROM rankings
     WHERE is_hidden = 0 AND deleted_at IS NULL GROUP BY is_global`
  );
  console.log("\nscopes:", scopes.map((s) => `${s.is_global ? "global" : "city"}:${s.n}`).join(", "));

  // 6. New cluster counts
  const clusters = await q(
    `SELECT c.slug, COUNT(*) AS n FROM rankings r
     JOIN categories c ON c.id = r.category_id
     WHERE r.is_archived = 0 AND r.is_hidden = 0 AND r.deleted_at IS NULL
       AND c.slug IN ('manga','anime','gaming','cosplay','digital-creators')
     GROUP BY c.slug`
  );
  console.log("\nnew clusters:", clusters.map((c) => `${c.slug}:${c.n}`).join(", "));

  // 7. Seed slug collisions (slug must be unique — a failed create would warn)
  const dupes = await q(
    `SELECT slug, COUNT(*) AS n FROM rankings GROUP BY slug HAVING n > 1`
  );
  console.log(`\nduplicate slugs: ${dupes.length}`);

  // 8. Legacy category rows remaining (referenced or not)
  const legacyCats = await q(
    `SELECT slug, name FROM categories WHERE slug NOT IN
     ('anime','manga','gaming','cosplay','digital-creators','music','fashion','art','university','food','sports','entertainment','events-nightlife')`
  );
  console.log(`\nlegacy category rows remaining: ${legacyCats.length}`);
  for (const l of legacyCats) console.log(`  ${l.slug} (${l.name})`);

  // 9. Sample migrated rows
  const sample = await q(
    `SELECT r.title, c.slug AS cat, s.slug AS sub, r.is_global
     FROM rankings r LEFT JOIN categories c ON c.id = r.category_id
     LEFT JOIN subcategories s ON s.id = r.subcategory_id
     WHERE r.slug IN ('best-anime-of-all-time','best-manga-of-all-time','best-game-of-all-time','best-uk-cosplayer','best-anime-tiktoker')
     ORDER BY r.slug`
  );
  console.log("\nsample rows:");
  for (const s of sample)
    console.log(`  ${s.title} | cat=${s.cat} sub=${s.sub} global=${s.is_global}`);

  console.log("\nDONE");
  process.exit(0);
}

main().catch((e) => {
  console.error("MIGRATION TEST FAILED:", e);
  process.exit(1);
});
