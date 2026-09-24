import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { db } from "./client";
import { findUserByEmail, createUser } from "./users";
import { recordAuditLog, AUDIT_ACTIONS } from "./auditLog";

// -----------------------------------------------------------------------
// Hide rankings that should not be publicly listed.
//
// Each entry carries a reason so future readers know why it is hidden:
//
// - Food Wars series (5 rivalry rankings: jollof, fried chicken, caribbean
//   takeaway, full english, late-night kebab): TEMPORARY hide at the
//   user's request (2026-09-24). Flip is_hidden back to 0 for these slugs
//   (or delete this step and unhide via admin panel) to bring the series
//   back.
//
// - "London's Best Music Borough 2026": hidden by standing product rule
//   (user decision 2026-09-24): rankings whose nominees cannot produce a
//   fan effect to help the platform acquire new users are not shown. A
//   borough has no account to campaign with; it cannot bring fans.
//
// Implementation: rows stay in the database with nominees intact, but are
// hidden from all public listings via the codebase's own is_hidden flag
// (PUBLIC_WHERE excludes is_hidden = 1). Admins can still see and restore
// them from the moderation panel.
//
// Idempotency: only touches rows where is_hidden = 0, so re-runs are
// no-ops. Runs AFTER all seeds in ensureMigrated(), and the seed steps key
// off slug via findRankingBySlug — which does not reset is_hidden — so a
// restart never unhides them.
//
// Best-effort: never allowed to throw, same convention as every other
// seed step, since this runs on every app start via ensureMigrated().
// -----------------------------------------------------------------------
const HIDDEN_RANKINGS: ReadonlyMap<string, string> = new Map([
  ["best-jollof-london-2026", "food_wars_temporary"],
  ["best-fried-chicken-shop-london-2026", "food_wars_temporary"],
  ["best-caribbean-takeaway-london-2026", "food_wars_temporary"],
  ["best-full-english-london-2026", "food_wars_temporary"],
  ["best-late-night-kebab-london-2026", "food_wars_temporary"],
  ["best-music-borough-london-2026", "no_fan_effect"],
]);

const SYSTEM_ACCOUNT_EMAIL = "team@rephear.com";
const SYSTEM_ACCOUNT_NAME = "RepHear Team";

async function getOrCreateSystemAccount() {
  const existing = await findUserByEmail(SYSTEM_ACCOUNT_EMAIL);
  if (existing) return existing;
  return createUser({
    email: SYSTEM_ACCOUNT_EMAIL,
    passwordHash: bcrypt.hashSync(randomUUID(), 10),
    name: SYSTEM_ACCOUNT_NAME,
    location: "London",
  });
}

interface HiddenRanking {
  id: string;
  slug: string | null;
  title: string;
}

export async function hideRankingsFromPublic(): Promise<void> {
  try {
    const systemUser = await getOrCreateSystemAccount();

    const rows = (await db
      .prepare(
        `SELECT id, slug, title FROM rankings
         WHERE is_hidden = 0 AND deleted_at IS NULL`
      )
      .all()) as unknown as HiddenRanking[];

    const targets = rows.filter(
      (r) => r.slug !== null && HIDDEN_RANKINGS.has(r.slug)
    );
    if (targets.length === 0) return;

    for (const ranking of targets) {
      await db
        .prepare("UPDATE rankings SET is_hidden = 1 WHERE id = ? AND is_hidden = 0")
        .run(ranking.id);

      await recordAuditLog({
        actorUserId: systemUser.id,
        action: AUDIT_ACTIONS.RANKING_HIDDEN,
        targetType: "ranking",
        targetId: ranking.id,
        details: {
          source: "hide_rankings_from_public",
          slug: ranking.slug,
          title: ranking.title,
          reason: ranking.slug ? HIDDEN_RANKINGS.get(ranking.slug) : "unknown",
          temporary: ranking.slug
            ? HIDDEN_RANKINGS.get(ranking.slug) === "food_wars_temporary"
            : false,
        },
      });
    }
  } catch (err) {
    console.warn(
      "Hide rankings from public failed:",
      err instanceof Error ? err.message : err
    );
  }
}
