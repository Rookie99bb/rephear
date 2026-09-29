import type { Visibility } from "@/lib/types";

// Phase 1 (v2 redesign): visibility plumbing shared by every read path
// that renders Likes / paid Supports publicly.
//
// Effective visibility is ALWAYS computed at read time as
//   COALESCE(action.visibility, user.show_*)
// and never materialized — so a user flipping their account default in
// Settings retroactively re-curates their public identity (the §9
// "curate my identity" promise) with no backfill and no migration.
//
// Two hard invariants live here:
//  1. Ranking aggregates NEVER consult visibility. SUM()/COUNT() totals
//     stay exactly as they are; private actions count fully.
//  2. Anything that renders *who* did an action (supporter lists, taste
//     overlap, badges) may only ever see rows whose effective
//     visibility is 'public'. Private rows are excluded from the JOIN,
//     not just hidden in UI — so private activity can never leak
//     through counts, hover-cards, or recommendations.

export type { Visibility };

export const VISIBILITIES: readonly Visibility[] = ["public", "private"];

export function isVisibility(value: unknown): value is Visibility {
  return value === "public" || value === "private";
}

// NULL action visibility = "inherit the user's account default".
// Unknown/missing user default falls back to 'public' (the product
// default); the DB columns are NOT NULL DEFAULT 'public' so this is
// purely defensive.
export function effectiveVisibility(
  actionVisibility: string | null | undefined,
  userDefault: string | null | undefined
): Visibility {
  if (isVisibility(actionVisibility)) return actionVisibility;
  if (isVisibility(userDefault)) return userDefault;
  return "public";
}

// SQL fragment (with ESCAPE) excluding synthetic seed accounts from any
// identity-adjacent query. `users.id` must be in scope under the given
// alias. The underscore in the prefix is escaped — without ESCAPE '\',
// `seed_community_%` would also match e.g. 'seedXcommunity...'.
export function seedAccountExclusion(alias: string): string {
  return `${alias}.id NOT LIKE 'seed\\_community\\_%' ESCAPE '\\'`;
}
