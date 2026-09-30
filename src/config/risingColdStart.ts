// Rising Now — production cold-start mode.
//
// During the launch cold-start phase, the production Rising Now module is
// approved to display seeded weekly engagement so the site does not look
// empty. This is PUBLIC-DISPLAY ONLY and fully reversible:
//
// - Seed values live here (config), never in the UI component and never
//   as fake rows in the likes table. No fake user accounts are created,
//   no organic like events are inserted or modified.
// - Displayed value = organic_weekly_likes + seed_weekly_likes.
// - Organic activity keeps being recorded normally and stays
//   distinguishable internally (rows carry both components separately).
// - Turning the flag off returns Rising Now to organic-only behaviour
//   with zero database cleanup.
//
// Env: RISING_COLD_START=1 enables cold-start mode. RISING_NOW_DEMO=1 is
// accepted as an alias (previous name of the same flag).

const ENV_KEYS = ["RISING_COLD_START", "RISING_NOW_DEMO"];

export function isRisingColdStartEnabled(): boolean {
  return ENV_KEYS.some((k) => process.env[k] === "1");
}

// Fixed, non-uniform, natural-looking seed values (weekly likes).
// Assigned positionally over the deterministically selected cold-start
// set — stable across page loads, never Math.random(). Explicit
// per-slug overrides (below) take precedence and survive reordering.
export const COLD_START_SEED_VALUES = [2817, 1934, 1426, 986, 742, 618];

// Optional explicit overrides: ranking slug -> seed weekly likes.
// Stable per ranking regardless of selection order. Slugs that do not
// resolve to a public ranking are ignored (dynamic selection fills in).
export const COLD_START_SEED_BY_SLUG: Record<string, number> = {};

// Launch-focus category priority for cold-start selection (diversity
// round-robin follows this order).
export const COLD_START_CATEGORY_PRIORITY = [
  "cosplay",
  "anime",
  "gaming",
  "manga",
  "digital-creators",
];
