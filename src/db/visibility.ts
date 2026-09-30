import type { Visibility } from "@/lib/types";
import { db } from "./client";

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

// ── Phase 2 (public identity) shared SQL fragments ────────────────────
// Centralized so every Phase 2 read path uses the identical
// effective-visibility contract. Never inline these fragments elsewhere.

// Effective-public check for an action row (likes / credit_transactions):
//   COALESCE(<action>.visibility, <user>.show_<kind>) = 'public'
// NULL action visibility = inherit the user's account default at read
// time (the §9 "curate my identity" promise).
export function pubClause(
  actionAlias: string,
  userAlias: string,
  kind: "supports" | "likes"
): string {
  const defCol = kind === "supports" ? "show_supports" : "show_likes";
  return `COALESCE(${actionAlias}.visibility, ${userAlias}.${defCol}) = 'public'`;
}

// Canonical Phase 2 name for the seed exclusion above.
export function notSeedClause(userAlias: string): string {
  return seedAccountExclusion(userAlias);
}

// Seed Likes Policy (2026-09-30): like provenance is explicit via
// likes.like_source = 'seed' | 'organic'. Public display may combine both;
// analytics, Rising/Trending velocity, and growth measurement must use
// organic only. Most Loved uses the weighted score (see
// engagementWeights.ts); cold-start defaults weight both at 1.0.

// Organic-only guard for like aggregations. Use for: Rising/Trending
// velocity, analytics, growth measurement, "new likes" counts.
export function authenticLikesClause(likesAlias: string): string {
  return `${likesAlias}.like_source = 'organic'`;
}

// Seed-only guard. Use for admin seed/organic split displays.
export function seedLikesClause(likesAlias: string): string {
  return `${likesAlias}.like_source = 'seed'`;
}

// Legacy name kept for call sites not yet migrated; identical to
// authenticLikesClause. New code should use authenticLikesClause.
export function organicLikesClause(likesAlias: string): string {
  return authenticLikesClause(likesAlias);
}

// Moderation hiding (users.is_hidden, added in Phase 2): hidden users
// vanish from every identity-adjacent surface (supporter lists, taste
// match sets, profile pages).
export function activeUserClause(userAlias: string): string {
  return `${userAlias}.is_hidden = 0`;
}

// Effective visibility of a conviction record = effective visibility of
// the FIRST paid Support (first_payment_id → payments.visibility_choice,
// falling back to the user's show_supports default for pre-Phase-1
// rows). First-wins: repeat supports never change it. Read-time, never
// materialized.
export async function getConvictionVisibility(
  convictionId: string
): Promise<Visibility> {
  const row = (await db
    .prepare(
      `SELECT COALESCE(p.visibility_choice, u.show_supports, 'public') AS v
       FROM conviction_records cr
       JOIN payments p ON p.id = cr.first_payment_id
       JOIN users u ON u.id = cr.user_id
       WHERE cr.id = ?`
    )
    .get(convictionId)) as unknown as { v: string } | undefined;
  return isVisibility(row?.v) ? row.v : "public";
}
