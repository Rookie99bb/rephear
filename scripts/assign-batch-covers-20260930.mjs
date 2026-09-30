// Assigns the 123 user-approved batch covers (V5/V6/V7 style family) to
// production rankings. User approved all 123 on 2026-09-30 ("\u90fd\u53ef\u4ee5\u7528\u4e86").
//
// Safety rules (same as assign-confirmed-covers.mjs):
// - Match by EXACT ranking title only. Zero or 2+ matches => SKIP + report.
// - Never touch rows where cover_image_status = 'manual' (admin-uploaded/locked).
// - Never overwrite a ranking that already has a DIFFERENT cover URL
//   (protects the 12 previously confirmed editorial covers).
// - Skip deleted/hidden rankings. Idempotent: re-running skips correct rows.
//
// Run in Render Shell (production env already has TURSO_DATABASE_URL /
// TURSO_AUTH_TOKEN):
//   node scripts/assign-batch-covers-20260930.mjs --dry-run   # verify first
//   node scripts/assign-batch-covers-20260930.mjs             # assign

import { createClient } from "@libsql/client";

const MAPPINGS = [
  { title: "Best Anime of 2026", url: "/covers/rankings/best-anime-of-2026-cover.webp", alt: "Best Anime of 2026 editorial artwork" },
  { title: "Most Overrated Anime Right Now", url: "/covers/rankings/most-overrated-anime-right-now-cover.webp", alt: "Most Overrated Anime Right Now editorial artwork" },
  { title: "Most Underrated Anime", url: "/covers/rankings/most-underrated-anime-cover.webp", alt: "Most Underrated Anime editorial artwork" },
  { title: "Anime Everyone Should Watch Once", url: "/covers/rankings/anime-everyone-should-watch-once-cover.webp", alt: "Anime Everyone Should Watch Once editorial artwork" },
  { title: "Best Anime for Beginners", url: "/covers/rankings/best-anime-for-beginners-cover.webp", alt: "Best Anime for Beginners editorial artwork" },
  { title: "Anime You Wish You Could Watch Again for the First Time", url: "/covers/rankings/anime-rewatch-first-time-cover.webp", alt: "Anime You Wish You Could Watch Again for the First Time editorial artwork" },
  { title: "Best Anime Protagonist", url: "/covers/rankings/best-anime-protagonist-cover.webp", alt: "Best Anime Protagonist editorial artwork" },
  { title: "Best Anime Villain", url: "/covers/rankings/best-anime-villain-cover.webp", alt: "Best Anime Villain editorial artwork" },
  { title: "Anime Characters With the Most Aura", url: "/covers/rankings/anime-characters-most-aura-cover.webp", alt: "Anime Characters With the Most Aura editorial artwork" },
  { title: "Most Iconic Anime Character of All Time", url: "/covers/rankings/most-iconic-anime-character-cover.webp", alt: "Most Iconic Anime Character of All Time editorial artwork" },
  { title: "Best Female Anime Character", url: "/covers/rankings/best-female-anime-character-cover.webp", alt: "Best Female Anime Character editorial artwork" },
  { title: "Best Anime Duo", url: "/covers/rankings/best-anime-duo-cover.webp", alt: "Best Anime Duo editorial artwork" },
  { title: "Best Anime Rivalry", url: "/covers/rankings/best-anime-rivalry-cover.webp", alt: "Best Anime Rivalry editorial artwork" },
  { title: "Best Anime Couple", url: "/covers/rankings/best-anime-couple-cover.webp", alt: "Best Anime Couple editorial artwork" },
  { title: "Best Anime Friendship", url: "/covers/rankings/best-anime-friendship-cover.webp", alt: "Best Anime Friendship editorial artwork" },
  { title: "Best Anime Character Development", url: "/covers/rankings/best-anime-character-development-cover.webp", alt: "Best Anime Character Development editorial artwork" },
  { title: "Best Anime Fight of All Time", url: "/covers/rankings/best-anime-fight-of-all-time-cover.webp", alt: "Best Anime Fight of All Time editorial artwork" },
  { title: "Best Anime Power System", url: "/covers/rankings/best-anime-power-system-cover.webp", alt: "Best Anime Power System editorial artwork" },
  { title: "Best Anime Worldbuilding", url: "/covers/rankings/best-anime-worldbuilding-cover.webp", alt: "Best Anime Worldbuilding editorial artwork" },
  { title: "Best Anime Plot Twist", url: "/covers/rankings/best-anime-plot-twist-cover.webp", alt: "Best Anime Plot Twist editorial artwork" },
  { title: "Best Anime Opening", url: "/covers/rankings/best-anime-opening-cover.webp", alt: "Best Anime Opening editorial artwork" },
  { title: "Best Anime Ending Song", url: "/covers/rankings/best-anime-ending-song-cover.webp", alt: "Best Anime Ending Song editorial artwork" },
  { title: "Best Anime Soundtrack", url: "/covers/rankings/best-anime-soundtrack-cover.webp", alt: "Best Anime Soundtrack editorial artwork" },
  { title: "Best Anime Animation", url: "/covers/rankings/best-anime-animation-cover.webp", alt: "Best Anime Animation editorial artwork" },
  { title: "Most Beautiful Anime", url: "/covers/rankings/most-beautiful-anime-cover.webp", alt: "Most Beautiful Anime editorial artwork" },
  { title: "Most Emotional Anime", url: "/covers/rankings/most-emotional-anime-cover.webp", alt: "Most Emotional Anime editorial artwork" },
  { title: "Funniest Anime", url: "/covers/rankings/funniest-anime-cover.webp", alt: "Funniest Anime editorial artwork" },
  { title: "Anime With the Strongest Fandom", url: "/covers/rankings/anime-strongest-fandom-cover.webp", alt: "Anime With the Strongest Fandom editorial artwork" },
  { title: "Best Manga Right Now", url: "/covers/rankings/best-manga-right-now-cover.webp", alt: "Best Manga Right Now editorial artwork" },
  { title: "Best Ongoing Manga 2026", url: "/covers/rankings/best-ongoing-manga-2026-cover.webp", alt: "Best Ongoing Manga 2026 editorial artwork" },
  { title: "Most Addictive Manga", url: "/covers/rankings/most-addictive-manga-cover.webp", alt: "Most Addictive Manga editorial artwork" },
  { title: "Most Overrated Manga Right Now", url: "/covers/rankings/most-overrated-manga-right-now-cover.webp", alt: "Most Overrated Manga Right Now editorial artwork" },
  { title: "Most Underrated Manga", url: "/covers/rankings/most-underrated-manga-cover.webp", alt: "Most Underrated Manga editorial artwork" },
  { title: "Manga Everyone Should Read Once", url: "/covers/rankings/manga-everyone-should-read-once-cover.webp", alt: "Manga Everyone Should Read Once editorial artwork" },
  { title: "Best Manga for Anime Fans", url: "/covers/rankings/best-manga-for-anime-fans-cover.webp", alt: "Best Manga for Anime Fans editorial artwork" },
  { title: "Best New-Gen Manga", url: "/covers/rankings/best-new-gen-manga-cover.webp", alt: "Best New-Gen Manga editorial artwork" },
  { title: "Manga Most Deserving of an Anime Adaptation", url: "/covers/rankings/manga-deserving-anime-adaptation-cover.webp", alt: "Manga Most Deserving of an Anime Adaptation editorial artwork" },
  { title: "Best Manga Art Style", url: "/covers/rankings/best-manga-art-style-cover.webp", alt: "Best Manga Art Style editorial artwork" },
  { title: "Best Manga Panels of All Time", url: "/covers/rankings/best-manga-panels-cover.webp", alt: "Best Manga Panels of All Time editorial artwork" },
  { title: "Best Manga Cover Art", url: "/covers/rankings/best-manga-cover-art-cover.webp", alt: "Best Manga Cover Art editorial artwork" },
  { title: "Best Manga Character Design", url: "/covers/rankings/best-manga-character-design-cover.webp", alt: "Best Manga Character Design editorial artwork" },
  { title: "Best Manga Protagonist", url: "/covers/rankings/best-manga-protagonist-cover.webp", alt: "Best Manga Protagonist editorial artwork" },
  { title: "Best Manga Villain", url: "/covers/rankings/best-manga-villain-cover.webp", alt: "Best Manga Villain editorial artwork" },
  { title: "Best Female Manga Character", url: "/covers/rankings/best-female-manga-character-cover.webp", alt: "Best Female Manga Character editorial artwork" },
  { title: "Best Manga Couple", url: "/covers/rankings/best-manga-couple-cover.webp", alt: "Best Manga Couple editorial artwork" },
  { title: "Best Manga Rivalry", url: "/covers/rankings/best-manga-rivalry-cover.webp", alt: "Best Manga Rivalry editorial artwork" },
  { title: "Most Heartbreaking Manga", url: "/covers/rankings/most-heartbreaking-manga-cover.webp", alt: "Most Heartbreaking Manga editorial artwork" },
  { title: "Funniest Manga", url: "/covers/rankings/funniest-manga-cover.webp", alt: "Funniest Manga editorial artwork" },
  { title: "Darkest Manga Worth Reading", url: "/covers/rankings/darkest-manga-worth-reading-cover.webp", alt: "Darkest Manga Worth Reading editorial artwork" },
  { title: "Best Romance Manga", url: "/covers/rankings/best-romance-manga-cover.webp", alt: "Best Romance Manga editorial artwork" },
  { title: "Best Horror Manga", url: "/covers/rankings/best-horror-manga-cover.webp", alt: "Best Horror Manga editorial artwork" },
  { title: "Best Manga Plot Twist", url: "/covers/rankings/best-manga-plot-twist-cover.webp", alt: "Best Manga Plot Twist editorial artwork" },
  { title: "Manga With the Best Worldbuilding", url: "/covers/rankings/manga-best-worldbuilding-cover.webp", alt: "Manga With the Best Worldbuilding editorial artwork" },
  { title: "Manga You Wish You Could Read Again for the First Time", url: "/covers/rankings/manga-read-first-time-cover.webp", alt: "Manga You Wish You Could Read Again for the First Time editorial artwork" },
  { title: "Game of the Year 2026 — Community Vote", url: "/covers/rankings/game-of-the-year-2026-cover.webp", alt: "Game of the Year 2026 — Community Vote editorial artwork" },
  { title: "Most Overrated Game Right Now", url: "/covers/rankings/most-overrated-game-right-now-cover.webp", alt: "Most Overrated Game Right Now editorial artwork" },
  { title: "Most Underrated Game", url: "/covers/rankings/most-underrated-game-cover.webp", alt: "Most Underrated Game editorial artwork" },
  { title: "Your Forever Game", url: "/covers/rankings/your-forever-game-cover.webp", alt: "Your Forever Game editorial artwork" },
  { title: "Game You Wish You Could Play Again for the First Time", url: "/covers/rankings/game-play-first-time-cover.webp", alt: "Game You Wish You Could Play Again for the First Time editorial artwork" },
  { title: "Most Addictive Game", url: "/covers/rankings/most-addictive-game-cover.webp", alt: "Most Addictive Game editorial artwork" },
  { title: "Best Multiplayer Game", url: "/covers/rankings/best-multiplayer-game-cover.webp", alt: "Best Multiplayer Game editorial artwork" },
  { title: "Best Co-op Game", url: "/covers/rankings/best-co-op-game-cover.webp", alt: "Best Co-op Game editorial artwork" },
  { title: "Best Competitive Game", url: "/covers/rankings/best-competitive-game-cover.webp", alt: "Best Competitive Game editorial artwork" },
  { title: "Best Open-World Game", url: "/covers/rankings/best-open-world-game-cover.webp", alt: "Best Open-World Game editorial artwork" },
  { title: "Best RPG", url: "/covers/rankings/best-rpg-cover.webp", alt: "Best RPG editorial artwork" },
  { title: "Best Horror Game", url: "/covers/rankings/best-horror-game-cover.webp", alt: "Best Horror Game editorial artwork" },
  { title: "Best Indie Game", url: "/covers/rankings/best-indie-game-cover.webp", alt: "Best Indie Game editorial artwork" },
  { title: "Best Cozy Game", url: "/covers/rankings/best-cozy-game-cover.webp", alt: "Best Cozy Game editorial artwork" },
  { title: "Best Story in Gaming", url: "/covers/rankings/best-story-in-gaming-cover.webp", alt: "Best Story in Gaming editorial artwork" },
  { title: "Best Game World", url: "/covers/rankings/best-game-world-cover.webp", alt: "Best Game World editorial artwork" },
  { title: "Best Video Game Character", url: "/covers/rankings/best-video-game-character-cover.webp", alt: "Best Video Game Character editorial artwork" },
  { title: "Best Gaming Villain", url: "/covers/rankings/best-gaming-villain-cover.webp", alt: "Best Gaming Villain editorial artwork" },
  { title: "Best Video Game Duo", url: "/covers/rankings/best-video-game-duo-cover.webp", alt: "Best Video Game Duo editorial artwork" },
  { title: "Best Video Game Romance", url: "/covers/rankings/best-video-game-romance-cover.webp", alt: "Best Video Game Romance editorial artwork" },
  { title: "Best Game Soundtrack", url: "/covers/rankings/best-game-soundtrack-cover.webp", alt: "Best Game Soundtrack editorial artwork" },
  { title: "Best Character Design in Gaming", url: "/covers/rankings/best-character-design-gaming-cover.webp", alt: "Best Character Design in Gaming editorial artwork" },
  { title: "Best Boss Fight of All Time", url: "/covers/rankings/best-boss-fight-of-all-time-cover.webp", alt: "Best Boss Fight of All Time editorial artwork" },
  { title: "Hardest Game You Actually Love", url: "/covers/rankings/hardest-game-you-love-cover.webp", alt: "Hardest Game You Actually Love editorial artwork" },
  { title: "Best Game to Play With Friends", url: "/covers/rankings/best-game-with-friends-cover.webp", alt: "Best Game to Play With Friends editorial artwork" },
  { title: "Game With the Best Community", url: "/covers/rankings/game-best-community-cover.webp", alt: "Game With the Best Community editorial artwork" },
  { title: "Game With the Most Chaotic Community", url: "/covers/rankings/game-most-chaotic-community-cover.webp", alt: "Game With the Most Chaotic Community editorial artwork" },
  { title: "Game That Defined Your Childhood", url: "/covers/rankings/game-defined-childhood-cover.webp", alt: "Game That Defined Your Childhood editorial artwork" },
  { title: "London's Best Cosplayer 2026", url: "/covers/rankings/londons-best-cosplayer-2026-cover.webp", alt: "London's Best Cosplayer 2026 editorial artwork" },
  { title: "Best Anime Cosplayer", url: "/covers/rankings/best-anime-cosplayer-cover.webp", alt: "Best Anime Cosplayer editorial artwork" },
  { title: "Best Gaming Cosplayer", url: "/covers/rankings/best-gaming-cosplayer-cover.webp", alt: "Best Gaming Cosplayer editorial artwork" },
  { title: "Best Manga Cosplay", url: "/covers/rankings/best-manga-cosplay-cover.webp", alt: "Best Manga Cosplay editorial artwork" },
  { title: "Best Male Cosplayer", url: "/covers/rankings/best-male-cosplayer-cover.webp", alt: "Best Male Cosplayer editorial artwork" },
  { title: "Best Female Cosplayer", url: "/covers/rankings/best-female-cosplayer-cover.webp", alt: "Best Female Cosplayer editorial artwork" },
  { title: "Best Duo Cosplay", url: "/covers/rankings/best-duo-cosplay-cover.webp", alt: "Best Duo Cosplay editorial artwork" },
  { title: "Best Group Cosplay", url: "/covers/rankings/best-group-cosplay-cover.webp", alt: "Best Group Cosplay editorial artwork" },
  { title: "Best Couple Cosplay", url: "/covers/rankings/best-couple-cosplay-cover.webp", alt: "Best Couple Cosplay editorial artwork" },
  { title: "Best Genderbend Cosplay", url: "/covers/rankings/best-genderbend-cosplay-cover.webp", alt: "Best Genderbend Cosplay editorial artwork" },
  { title: "Best Villain Cosplay", url: "/covers/rankings/best-villain-cosplay-cover.webp", alt: "Best Villain Cosplay editorial artwork" },
  { title: "Best Cosplay Transformation", url: "/covers/rankings/best-cosplay-transformation-cover.webp", alt: "Best Cosplay Transformation editorial artwork" },
  { title: "Best Makeup Transformation", url: "/covers/rankings/best-makeup-transformation-cover.webp", alt: "Best Makeup Transformation editorial artwork" },
  { title: "Best Wig Styling", url: "/covers/rankings/best-wig-styling-cover.webp", alt: "Best Wig Styling editorial artwork" },
  { title: "Best Handmade Costume", url: "/covers/rankings/best-handmade-costume-cover.webp", alt: "Best Handmade Costume editorial artwork" },
  { title: "Best Armour Build", url: "/covers/rankings/best-armour-build-cover.webp", alt: "Best Armour Build editorial artwork" },
  { title: "Best Prop Maker", url: "/covers/rankings/best-prop-maker-cover.webp", alt: "Best Prop Maker editorial artwork" },
  { title: "Best Cosplay Photographer", url: "/covers/rankings/best-cosplay-photographer-cover.webp", alt: "Best Cosplay Photographer editorial artwork" },
  { title: "Best Cosplay Video Creator", url: "/covers/rankings/best-cosplay-video-creator-cover.webp", alt: "Best Cosplay Video Creator editorial artwork" },
  { title: "Best Cosplay Performance", url: "/covers/rankings/best-cosplay-performance-cover.webp", alt: "Best Cosplay Performance editorial artwork" },
  { title: "Best Convention Look", url: "/covers/rankings/best-convention-look-cover.webp", alt: "Best Convention Look editorial artwork" },
  { title: "Best MCM London Cosplay", url: "/covers/rankings/best-mcm-london-cosplay-cover.webp", alt: "Best MCM London Cosplay editorial artwork" },
  { title: "Most Creative Cosplay", url: "/covers/rankings/most-creative-cosplay-cover.webp", alt: "Most Creative Cosplay editorial artwork" },
  { title: "Most Accurate Cosplay", url: "/covers/rankings/most-accurate-cosplay-cover.webp", alt: "Most Accurate Cosplay editorial artwork" },
  { title: "Most Unexpected Cosplay", url: "/covers/rankings/most-unexpected-cosplay-cover.webp", alt: "Most Unexpected Cosplay editorial artwork" },
  { title: "Funniest Cosplay Creator", url: "/covers/rankings/funniest-cosplay-creator-cover.webp", alt: "Funniest Cosplay Creator editorial artwork" },
  { title: "Cosplayer With the Most Aura", url: "/covers/rankings/cosplayer-most-aura-cover.webp", alt: "Cosplayer With the Most Aura editorial artwork" },
  { title: "London Cosplay Creator of the Year 2026", url: "/covers/rankings/london-cosplay-creator-of-the-year-2026-cover.webp", alt: "London Cosplay Creator of the Year 2026 editorial artwork" },
  { title: "Best Anime Content Creator", url: "/covers/rankings/best-anime-content-creator-cover.webp", alt: "Best Anime Content Creator editorial artwork" },
  { title: "Anime TikTok Creator to Watch", url: "/covers/rankings/anime-tiktok-creator-to-watch-cover.webp", alt: "Anime TikTok Creator to Watch editorial artwork" },
  { title: "Best Anime YouTuber", url: "/covers/rankings/best-anime-youtuber-cover.webp", alt: "Best Anime YouTuber editorial artwork" },
  { title: "Best Anime Video Editor", url: "/covers/rankings/best-anime-video-editor-cover.webp", alt: "Best Anime Video Editor editorial artwork" },
  { title: "Best Anime Fan Artist", url: "/covers/rankings/best-anime-fan-artist-cover.webp", alt: "Best Anime Fan Artist editorial artwork" },
  { title: "Manga Creator to Watch", url: "/covers/rankings/manga-creator-to-watch-cover.webp", alt: "Manga Creator to Watch editorial artwork" },
  { title: "Gaming Creator to Watch", url: "/covers/rankings/gaming-creator-to-watch-cover.webp", alt: "Gaming Creator to Watch editorial artwork" },
  { title: "Best Gaming Streamer", url: "/covers/rankings/best-gaming-streamer-cover.webp", alt: "Best Gaming Streamer editorial artwork" },
  { title: "Best Gaming TikTok Creator", url: "/covers/rankings/best-gaming-tiktok-creator-cover.webp", alt: "Best Gaming TikTok Creator editorial artwork" },
  { title: "Rising VTuber", url: "/covers/rankings/rising-vtuber-cover.webp", alt: "Rising VTuber editorial artwork" },
  { title: "Best Cosplay Creator", url: "/covers/rankings/best-cosplay-creator-cover.webp", alt: "Best Cosplay Creator editorial artwork" },
  { title: "Best Cosplay Photographer", url: "/covers/rankings/best-cosplay-photographer-creator-cover.webp", alt: "Best Cosplay Photographer editorial artwork" },
  { title: "Best Cosplay Video Creator", url: "/covers/rankings/best-cosplay-video-creator-creator-cover.webp", alt: "Best Cosplay Video Creator editorial artwork" },];

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
      entry.action = "SKIP"; entry.detail = `manual/locked cover present (${r.cover_image_url}) — never overwrite`;
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
        entry.action = "ASSIGNED"; entry.detail = "ok";
      }
    }
  }
  results.push(entry);
}

const counts = {};
for (const r of results) counts[r.action] = (counts[r.action] || 0) + 1;
console.log(JSON.stringify({ dryRun, counts }, null, 1));
for (const r of results.filter((r) => r.action !== "ASSIGNED" && !(dryRun && r.action === "WOULD-ASSIGN"))) {
  console.log(`${r.action}\t${r.title}\t${r.detail}`);
}
if (dryRun) {
  const would = results.filter((r) => r.action === "WOULD-ASSIGN");
  console.log(`\n${would.length} would be assigned.`);
}
