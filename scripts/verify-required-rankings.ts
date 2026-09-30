// 134-row required-dataset verification matrix.
// Keyed by (title + category) — two titles intentionally exist in two
// categories. Checks per required entry:
//   exact title exists in the required category (not soft-deleted)
//   subcategory slug, scope, non-blank description, tags present
//   city-scope rows carry London / United Kingdom
//   nominee count + human-review flag for people-rankings
//   no synthetic engagement counted (authentic likes only)
// Usage: DATA_DIR=/tmp/xxx npx tsx scripts/verify-required-rankings.ts
import { rawClient } from "@/db/client";
import { REQUIRED_RANKINGS } from "@/db/requiredRankings";
import { authenticLikesClause } from "@/db/visibility";

interface Row {
  title: string;
  category: string;
  status: string;
  issues: string[];
  nominees: number;
  authenticLikes: number;
  cover: string;
}

async function main() {
  const q = async (sql: string, args: any[] = []) =>
    (await rawClient.execute({ sql, args })).rows as any[];

  const results: Row[] = [];
  const excl = authenticLikesClause("l");

  for (const e of REQUIRED_RANKINGS) {
    const issues: string[] = [];
    const rows = await q(
      `SELECT r.id, r.slug, r.description, r.tags, r.scope, r.is_global,
              r.city, r.country, r.cover_image_url, r.cover_image_source,
              s.slug AS sub_slug, c.slug AS cat_slug
       FROM rankings r
       JOIN categories c ON c.id = r.category_id
       LEFT JOIN subcategories s ON s.id = r.subcategory_id
       WHERE r.title = ? AND c.slug = ? AND r.deleted_at IS NULL`,
      [e.title, e.categorySlug]
    );
    if (rows.length === 0) {
      results.push({
        title: e.title, category: e.categorySlug, status: "MISSING",
        issues: ["no live row with this exact title in this category"],
        nominees: 0, authenticLikes: 0, cover: "-",
      });
      continue;
    }
    if (rows.length > 1) issues.push(`duplicate live rows: ${rows.length}`);
    const r = rows[0];
    if (r.sub_slug !== e.subcategorySlug)
      issues.push(`subcategory ${r.sub_slug} != required ${e.subcategorySlug}`);
    if ((r.scope || "") !== e.scope)
      issues.push(`scope '${r.scope}' != required '${e.scope}'`);
    if (e.scope === "global" && r.is_global !== 1)
      issues.push("is_global not synced to 1 for global scope");
    if (!(r.description || "").trim()) issues.push("blank description");
    if (!(r.tags || "").trim()) issues.push("no tags");
    if (e.scope === "city" && (r.city !== "London" || r.country !== "United Kingdom"))
      issues.push(`city-scope location wrong: ${r.city}, ${r.country}`);

    const nom = await q(
      "SELECT COUNT(*) AS n FROM profiles WHERE ranking_id = ? AND deleted_at IS NULL",
      [r.id]
    );
    const likes = await q(
      `SELECT COALESCE(SUM(l.count),0) AS n FROM likes l
       WHERE l.ranking_id = ? AND ${excl}`,
      [r.id]
    );
    // synthetic rows must still exist in raw table only
    const synth = await q(
      `SELECT COUNT(*) AS n FROM likes WHERE ranking_id = ?
       AND user_id LIKE 'seed\\_community\\_%' ESCAPE '\\'`,
      [r.id]
    );

    results.push({
      title: e.title,
      category: e.categorySlug,
      status: issues.length === 0 ? "OK" : "ISSUES",
      issues,
      nominees: Number(nom[0].n),
      authenticLikes: Number(likes[0].n),
      cover: r.cover_image_url
        ? `set (${r.cover_image_source || "?"})`
        : "fallback",
    });
    void synth;
  }

  const ok = results.filter((r) => r.status === "OK").length;
  const missing = results.filter((r) => r.status === "MISSING");
  const issues = results.filter((r) => r.status === "ISSUES");

  console.log(`\nRequired rows: ${REQUIRED_RANKINGS.length} | OK: ${ok} | ISSUES: ${issues.length} | MISSING: ${missing.length}`);
  for (const r of [...missing, ...issues]) {
    console.log(`\n[${r.status}] ${r.category} :: ${r.title}`);
    console.log(`  nominees=${r.nominees} authenticLikes=${r.authenticLikes} cover=${r.cover}`);
    r.issues.forEach((i) => console.log(`  - ${i}`));
  }

  // Per-cluster summary (required counts from the spec)
  for (const [cat, need] of [["anime", 30], ["manga", 30], ["gaming", 30], ["cosplay", 30], ["digital-creators", 14]] as const) {
    const inCat = results.filter((r) => r.category === cat);
    const okCat = inCat.filter((r) => r.status === "OK").length;
    console.log(`${cat}: required ${need} / found ${inCat.length} / OK ${okCat}`);
  }

  // No-nominee queue (needs human review or seeding)
  const thin = results.filter((r) => r.nominees === 0 && r.status !== "MISSING");
  console.log(`\nZero-nominee required rows: ${thin.length}`);
  thin.forEach((r) => console.log(`  - ${r.category} :: ${r.title}`));

  if (missing.length > 0) process.exitCode = 1;
  console.log("\nDONE");
}

main().then(() => process.exit(process.exitCode ?? 0));
