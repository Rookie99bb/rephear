import { db } from "./client";

// -----------------------------------------------------------------------
// User-defined display order of the category sections on the /rankings
// browse page (set 2026-09-24). University Societies first, Cosplay
// second, Club Nights last; everything else keeps its original seed
// order in the middle.
//
// Idempotent: plain UPDATEs keyed off the stable category slug, safe to
// run on every boot via ensureMigrated(). Unknown slugs are ignored so
// future categories added by other seeds simply keep sort_order 0 and
// sort before the ordered ones — add them here when their position is
// decided.
// -----------------------------------------------------------------------
const CATEGORY_ORDER: ReadonlyArray<string> = [
  "university-societies", // University Societies — 1st
  "cosplay", // Cosplay — 2nd
  "kpop-dance", // K-pop Dance
  "digital-creators", // Digital Creators
  "underground-rap", // Underground Rap
  "football-culture", // Football Culture
  "uk-rap-grime", // UK Rap & Grime
  "dj-genres", // DJ Genres
  "comedy", // Comedy
  "nightlife-personalities", // Nightlife Personalities
  "radio-livestream", // Radio & Livestream
  "streetwear-fashion-creators", // Streetwear & Fashion Creators
  "food-drink-creators", // Food & Drink Creators
  "screen-stage", // Screen & Stage
  "football-tribes", // Football Tribes
  "food-wars", // Food Wars (hidden from public, order kept for admin)
  "scene-rivalries", // Scene Rivalries
  "beauty-creators", // Beauty Creators
  "club-nights", // Club Nights — last
];

export async function applyCategoryOrder(): Promise<void> {
  try {
    for (let i = 0; i < CATEGORY_ORDER.length; i++) {
      await db
        .prepare("UPDATE categories SET sort_order = ? WHERE slug = ?")
        .run(i + 1, CATEGORY_ORDER[i]);
    }
  } catch {
    // Best-effort: never allowed to throw, same convention as every other
    // seed step, since this runs on every app start via ensureMigrated().
  }
}
