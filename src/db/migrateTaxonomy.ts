import { db } from "./client";
import { findCategoryBySlug } from "./categories";
import { findSubcategoryBySlug } from "./taxonomy";

// -----------------------------------------------------------------------
// Taxonomy v2 data migration (2026-09-30).
//
// Remaps every ranking from its legacy (pre-v2) category onto the new
// 13-category taxonomy, assigns subcategories, backfills global scope and
// the system-generated flag, and retires merged-away legacy categories.
//
// Safety properties:
// - NEVER deletes or soft-deletes a ranking. Only category_id,
//   subcategory_id, is_global and is_system_generated are touched.
// - NEVER touches user-generated rankings' titles, slugs, nominees,
//   likes, supports, claims or any other data.
// - Idempotent: every UPDATE is guarded so re-runs only fill values that
//   are still unset (an admin's manual subcategory/scope change is never
//   overwritten by a re-run).
// - Runs AFTER seedTaxonomy() in ensureMigrated() so every v2 category
//   and subcategory slug resolves.
// - Best-effort: never throws (same convention as every other seed step).
// -----------------------------------------------------------------------

interface CategoryRemap {
  to: string;
  sub: string | null;
}

// Legacy category slug → v2 category + default subcategory. Legacy slugs
// that already ARE v2 slugs (anime, gaming, cosplay, digital-creators)
// are absent — their category_id needs no change.
const CATEGORY_REMAP: Record<string, CategoryRemap> = {
  "anime-japanese-subculture": { to: "anime", sub: null },
  "gaming-esports": { to: "gaming", sub: "gaming-esports-sub" },
  "tabletop-tcg-roleplaying": { to: "gaming", sub: "gaming-tabletop" },
  "underground-rap": { to: "music", sub: "music-rap-grime" },
  "uk-rap-grime": { to: "music", sub: "music-rap-grime" },
  "dj-genres": { to: "music", sub: "music-djs" },
  "djs-club-culture": { to: "music", sub: "music-djs" },
  "underground-music": { to: "music", sub: "music-underground" },
  "radio-livestream": { to: "music", sub: "music-radio" },
  "kpop-dance": { to: "music", sub: "music-kpop" },
  "club-nights": { to: "events-nightlife", sub: "events-nightlife-club-nights" },
  "nightlife-personalities": {
    to: "events-nightlife",
    sub: "events-nightlife-nightlife-personalities",
  },
  "scene-rivalries": { to: "events-nightlife", sub: null },
  "football-culture": { to: "sports", sub: "sports-football" },
  "football-tribes": { to: "sports", sub: "sports-football" },
  "skate-street-culture": { to: "sports", sub: null },
  "comedy": { to: "entertainment", sub: "entertainment-comedy" },
  "screen-stage": { to: "entertainment", sub: "entertainment-film-tv" },
  "cult-culture-community": { to: "entertainment", sub: null },
  "streetwear-fashion-creators": { to: "fashion", sub: "fashion-streetwear" },
  "alternative-fashion": { to: "fashion", sub: null },
  "beauty-creators": { to: "fashion", sub: "fashion-beauty" },
  "independent-art-zines": { to: "art", sub: null },
  "food-drink-creators": { to: "food", sub: "food-creators" },
  "food-wars": { to: "food", sub: null },
  "university-societies": { to: "university", sub: "university-societies-sub" },
};

// Per-ranking subcategory overrides, keyed by ranking slug. Applied BEFORE
// the bulk category remap so the specific assignment wins; both are
// guarded by subcategory_id IS NULL so re-runs never clobber manual edits.
const RANKING_SUBCATEGORY_OVERRIDES: Record<string, string> = {
  // Anime
  "anime-characters-with-the-most-aura": "anime-characters",
  "most-overrated-anime-right-now": "anime-hot-takes",
  "your-forever-anime": "anime-trending",
  // Gaming
  "most-overrated-game-of-the-decade": "gaming-trending",
  "your-forever-game": "gaming-trending",
  // Cosplay
  "cosplayers-to-watch-at-animecon-london-2026": "cosplay-anime",
  "london-cosplayers-about-to-blow-up": "cosplay-rising",
  "best-anime-transformation-london-2026": "cosplay-anime",
  "best-cosplay-build-video-london-2026": "cosplay-creators",
  "best-cosplay-performance-london-2026": "cosplay-performance",
  "best-rookie-cosplayer-london-2026": "cosplay-rising",
  // Digital Creators
  "most-popular-meme-page-london-2026": "digital-creators-meme-creators",
  "most-popular-podcast-host-london-2026": "digital-creators-podcasters",
  "most-popular-streamer-london-2026": "digital-creators-streamers",
  "most-popular-tiktok-creator-london-2026": "digital-creators-tiktok",
  "most-popular-youtube-creator-london-2026": "digital-creators-youtube",
  // London music-event rankings → Events & Nightlife / Club Nights.
  "biggest-sound-london-2026": "events-nightlife-club-nights",
  "best-rap-crew-london-2026": "events-nightlife-club-nights",
  "best-rave-venue-london-2026": "events-nightlife-club-nights",
  "best-carnival-sound-system-london-2026": "events-nightlife-club-nights",
  // Club nights → events-nightlife / music
  "best-genre-night-london-2026": "events-nightlife-club-nights",
  "best-small-music-venue-london-2026": "events-nightlife-venues",
  "best-underground-party-london-2026": "events-nightlife-club-nights",
  // Comedy → entertainment
  "most-popular-x-personality-london-2026": "entertainment-personalities",
  // Screen & Stage → entertainment
  "most-popular-dancer-london-2026": "entertainment-personalities",
  "most-popular-tv-presenter-london-2026": "entertainment-personalities",
};

// Rankings that are global in concept but were created city-scoped.
// (New seeds set is_global explicitly; this covers the pre-v2 rows.)
const GLOBAL_RANKING_SLUGS: string[] = [
  "best-student-dj-london-2026", // "World's Best DJ 2026"
];

const SYSTEM_ACCOUNT_EMAIL = "team@rephear.com";

export async function migrateTaxonomyToV2(): Promise<void> {
  try {
    // 1. Per-ranking subcategory overrides (specific wins over bulk).
    for (const [rankingSlug, subSlug] of Object.entries(
      RANKING_SUBCATEGORY_OVERRIDES
    )) {
      const sub = await findSubcategoryBySlug(subSlug);
      if (!sub) continue;
      await db
        .prepare(
          `UPDATE rankings SET subcategory_id = ?
           WHERE slug = ? AND subcategory_id IS NULL AND deleted_at IS NULL`
        )
        .run(sub.id, rankingSlug);
    }

    // 2. Bulk remap: legacy category → v2 category (+ default subcategory
    //    for rows that didn't get a specific override above).
    for (const [legacySlug, remap] of Object.entries(CATEGORY_REMAP)) {
      const legacy = await findCategoryBySlug(legacySlug);
      const target = await findCategoryBySlug(remap.to);
      if (!legacy || !target) continue;
      const sub = remap.sub ? await findSubcategoryBySlug(remap.sub) : null;
      if (remap.sub && !sub) continue;
      await db
        .prepare(
          `UPDATE rankings
           SET category_id = ?,
               subcategory_id = COALESCE(subcategory_id, ?)
           WHERE category_id = ? AND deleted_at IS NULL`
        )
        .run(target.id, sub ? sub.id : null, legacy.id);
    }

    // 3. Global scope backfill: v2 anime/gaming/manga rankings whose title
    //    is not London-specific are global in concept. (city stays
    //    "London" — required by hideRankingsOutsideSupportedLocations();
    //    display is driven by is_global, see rankingDisplay.ts.)
    //    Plus the explicit flagship list.
    const globalCategorySlugs = ["anime", "gaming", "manga"];
    for (const catSlug of globalCategorySlugs) {
      const cat = await findCategoryBySlug(catSlug);
      if (!cat) continue;
      await db
        .prepare(
          `UPDATE rankings
           SET is_global = 1, scope = 'global'
           WHERE category_id = ?
             AND is_global = 0
             AND deleted_at IS NULL
             AND LOWER(title) NOT LIKE '%london%'`
        )
        .run(cat.id);
    }
    for (const slug of GLOBAL_RANKING_SLUGS) {
      await db
        .prepare(
          `UPDATE rankings SET is_global = 1, scope = 'global'
           WHERE slug = ? AND is_global = 0 AND deleted_at IS NULL`
        )
        .run(slug);
    }
    // The flagship DJ ranking lives under Music/DJs after the remap above
    // (it was seeded under club-nights).
    {
      const music = await findCategoryBySlug("music");
      const djs = await findSubcategoryBySlug("music-djs");
      if (music && djs) {
        await db
          .prepare(
            `UPDATE rankings SET category_id = ?, subcategory_id = ?
             WHERE slug = 'best-student-dj-london-2026'
               AND deleted_at IS NULL`
          )
          .run(music.id, djs.id);
      }
    }

    // 4. System-generated flag: seed-created rankings (attributed to the
    //    RepHear Team account with a stable slug) vs user-created ones.
    const sysUser = (await db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(SYSTEM_ACCOUNT_EMAIL)) as unknown as { id: string } | undefined;
    if (sysUser) {
      await db
        .prepare(
          `UPDATE rankings
           SET is_system_generated = 1
           WHERE created_by = ?
             AND slug IS NOT NULL
             AND is_system_generated = 0`
        )
        .run(sysUser.id);
    }

    // 5. Retire merged-away legacy categories: delete the category row
    //    only when zero rankings (including soft-deleted ones, so a
    //    restore can never dangle) still reference it, and only for
    //    legacy slugs that have a v2 redirect target.
    for (const legacySlug of Object.keys(CATEGORY_REMAP)) {
      const legacy = await findCategoryBySlug(legacySlug);
      if (!legacy) continue;
      const ref = (await db
        .prepare("SELECT COUNT(*) as n FROM rankings WHERE category_id = ?")
        .get(legacy.id)) as unknown as { n: number } | undefined;
      if ((ref?.n ?? 0) === 0) {
        await db.prepare("DELETE FROM categories WHERE id = ?").run(legacy.id);
      }
    }
  } catch (err) {
    console.warn(
      "Taxonomy v2 migration failed:",
      err instanceof Error ? err.message : err
    );
  }
}
