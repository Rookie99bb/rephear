import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { db } from "./client";
import { findUserByEmail, createUser } from "./users";
import { recordAuditLog, AUDIT_ACTIONS } from "./auditLog";
import { VIRAL_RANKING_SLUGS } from "./viralRankings";
import { RIVALRY_RANKING_SLUGS } from "./rivalryRankings";
import { TIER_ONE_RANKING_SLUGS } from "./tierOneRankings";
import { BEAUTY_RANKING_SLUGS } from "./beautyRankings";

// -----------------------------------------------------------------------
// Prune legacy rankings: soft-delete every ranking that is NOT part of the
// 89 cold-start rankings (50 viral + 15 rivalry + 21 tier-one + 3 beauty).
//
// Why soft delete instead of hard delete: the codebase's own convention
// (see softDeleteRanking in rankings.ts) is that deleting a ranking only
// flips deleted_at — nominees, likes, payments and credit transactions are
// left intact, public reads exclude soft-deleted rows, the detail page
// 404s for non-admins, and an admin can restore with one flag flip.
// There is no ON DELETE CASCADE anywhere in the schema, so a hard delete
// would violate foreign keys.
//
// Idempotency: only touches rows where deleted_at IS NULL, so re-runs are
// no-ops. Runs AFTER all seeds in ensureMigrated(), and the old always-run
// seeds (London niche, LA, NY) key off slug via findRankingBySlug — which
// returns soft-deleted rows too — so they never resurrect a pruned ranking.
//
// Best-effort: never allowed to throw, same convention as every other seed
// step, since this runs on every app start via ensureMigrated().
// -----------------------------------------------------------------------
const SYSTEM_ACCOUNT_EMAIL = "team@rephear.com";
const SYSTEM_ACCOUNT_NAME = "RepHear Team";

const KEEP_SLUGS: ReadonlySet<string> = new Set([
  ...VIRAL_RANKING_SLUGS,
  ...RIVALRY_RANKING_SLUGS,
  ...TIER_ONE_RANKING_SLUGS,
  ...BEAUTY_RANKING_SLUGS,
]);

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

interface DoomedRanking {
  id: string;
  slug: string | null;
  title: string;
}

export async function pruneLegacyRankings(): Promise<void> {
  try {
    const rows = (await db
      .prepare("SELECT id, slug, title FROM rankings WHERE deleted_at IS NULL")
      .all()) as unknown as DoomedRanking[];

    const doomed = rows.filter(
      (r) => r.slug === null || !KEEP_SLUGS.has(r.slug)
    );
    if (doomed.length === 0) return;

    const systemUser = await getOrCreateSystemAccount();

    for (const ranking of doomed) {
      await db
        .prepare(
          "UPDATE rankings SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL"
        )
        .run(ranking.id);

      await recordAuditLog({
        actorUserId: systemUser.id,
        action: AUDIT_ACTIONS.RANKING_SOFT_DELETED,
        targetType: "ranking",
        targetId: ranking.id,
        details: {
          source: "prune_legacy_rankings",
          slug: ranking.slug,
          title: ranking.title,
        },
      });
    }

    console.log(
      `Pruned ${doomed.length} legacy ranking(s) not in the cold-start set.`
    );
  } catch (err) {
    console.warn(
      "Legacy Rankings pruning failed:",
      err instanceof Error ? err.message : err
    );
  }
}
