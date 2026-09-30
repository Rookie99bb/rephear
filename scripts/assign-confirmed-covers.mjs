// Assigns the 12 user-confirmed AI editorial covers to production rankings.
//
// Safety rules (per user instruction 2026-09-30):
// - Match by EXACT ranking title only. Zero or 2+ matches => SKIP + report.
// - Never touch rows where cover_image_status = 'manual' (admin-uploaded/locked).
// - Never overwrite a ranking that already has a DIFFERENT cover URL.
// - Skip deleted/hidden rankings. Skip + report when the ranking is missing.
// - Idempotent: re-running skips already-correct rows.
//
// Run in Render Shell (production env already has TURSO_DATABASE_URL /
// TURSO_AUTH_TOKEN):
//   node scripts/assign-confirmed-covers.mjs --dry-run   # verify first
//   node scripts/assign-confirmed-covers.mjs             # assign
//
// Local test:
//   TURSO_DATABASE_URL=file:/home/hatch/workspace/rephear/data/app.db \
//     node scripts/assign-confirmed-covers.mjs --dry-run

import { createClient } from "@libsql/client";

const MAPPINGS = [
  { title: "London's Best Anime Transformation 2026", url: "/covers/rankings/cosplay-transformation-2026.webp", alt: "Anime transformation-inspired cosplay editorial" },
  { title: "London's Best Rookie Cosplayer 2026", url: "/covers/rankings/rookie-cosplayer-2026.webp", alt: "Energetic London cosplay convention editorial" },
  { title: "London's Best Cosplay Performance 2026", url: "/covers/rankings/cosplay-performance-2026.webp", alt: "Cosplay stage performance editorial" },
  { title: "London Cosplayers About to Blow Up", url: "/covers/rankings/cosplayers-blow-up.webp", alt: "Rising cosplay creator editorial" },
  { title: "Best Manga of All Time", url: "/covers/rankings/manga-best-all-time.webp", alt: "Epic manga hall of fame editorial artwork" },
  { title: "Best Sports Manga", url: "/covers/rankings/manga-sports.webp", alt: "Sports manga-inspired editorial artwork" },
  { title: "Best Fantasy Manga", url: "/covers/rankings/manga-fantasy.webp", alt: "Fantasy manga-inspired editorial artwork" },
  { title: "Best Psychological Manga", url: "/covers/rankings/manga-psychological.webp", alt: "Psychological manga-inspired editorial artwork" },
  { title: "Best Anime Right Now", url: "/covers/rankings/anime-right-now.webp", alt: "Contemporary anime editorial artwork" },
  { title: "Best Anime of All Time", url: "/covers/rankings/anime-best-all-time.webp", alt: "Epic anime hall of fame editorial artwork" },
  { title: "Best Game Right Now", url: "/covers/rankings/gaming-best-right-now.webp", alt: "Contemporary gaming editorial artwork" },
  { title: "Best Game of All Time", url: "/covers/rankings/gaming-best-all-time.webp", alt: "Epic gaming hall of fame editorial artwork" },
];

const dryRun = process.argv.includes("--dry-run");
const dbUrl = process.env.TURSO_DATABASE_URL;
if (!dbUrl) {
  console.error("FATAL: TURSO_DATABASE_URL is not set.");
  process.exit(1);
}
const client = createClient({ url: dbUrl, authToken: process.env.TURSO_AUTH_TOKEN });

const results = [];
for (const m of MAPPINGS) {
  const res = await client.execute({
    sql: `SELECT id, title, slug, deleted_at, is_hidden,
                 cover_image_url, cover_image_source, cover_image_status
          FROM rankings WHERE title = ?`,
    args: [m.title],
  });
  const entry = { title: m.title, cover: m.url, action: "", detail: "" };
  if (res.rows.length === 0) {
    entry.action = "SKIP"; entry.detail = "ranking not found in this DB";
  } else if (res.rows.length > 1) {
    entry.action = "SKIP";
    entry.detail = `ambiguous: ${res.rows.length} rows share this title`;
  } else {
    const r = res.rows[0];
    entry.rankingId = r.id;
    entry.slug = r.slug;
    if (r.deleted_at || r.is_hidden) {
      entry.action = "SKIP"; entry.detail = "ranking is deleted/hidden";
    } else if (r.cover_image_status === "manual") {
      entry.action = "SKIP";
      entry.detail = `manual/locked cover present (${r.cover_image_url}) — never overwrite`;
    } else if (r.cover_image_url === m.url) {
      entry.action = "SKIP"; entry.detail = "already assigned (idempotent)";
    } else if (r.cover_image_url) {
      entry.action = "SKIP";
      entry.detail = `different cover already set (${r.cover_image_url}, status=${r.cover_image_status}) — not overwriting`;
    } else {
      if (dryRun) {
        entry.action = "WOULD-ASSIGN";
        entry.detail = `status=${r.cover_image_status}, no cover yet`;
      } else {
        await client.execute({
          sql: `UPDATE rankings SET cover_image_url = ?, cover_image_source = 'ai_editorial',
                cover_image_updated_at = datetime('now'), cover_image_alt = ?,
                cover_image_status = 'active' WHERE id = ?`,
          args: [m.url, m.alt, r.id],
        });
        entry.action = "ASSIGNED"; entry.detail = "cover assigned";
      }
    }
  }
  results.push(entry);
}

console.log(dryRun ? "=== DRY RUN ===" : "=== LIVE ===");
for (const e of results) {
  console.log(`[${e.action}] ${e.title}`);
  console.log(`         id=${e.rankingId ?? "-"} slug=${e.slug ?? "-"} -> ${e.cover}`);
  console.log(`         ${e.detail}`);
}
const counts = {};
for (const e of results) counts[e.action] = (counts[e.action] || 0) + 1;
console.log("SUMMARY:", JSON.stringify(counts));
client.close();
