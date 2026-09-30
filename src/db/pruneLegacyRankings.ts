import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { db } from "./client";
import { findUserByEmail, createUser } from "./users";
import { recordAuditLog, AUDIT_ACTIONS } from "./auditLog";
import { VIRAL_RANKING_SLUGS } from "./viralRankings";
import { RIVALRY_RANKING_SLUGS } from "./rivalryRankings";
import { TIER_ONE_RANKING_SLUGS } from "./tierOneRankings";
import { BEAUTY_RANKING_SLUGS } from "./beautyRankings";
import { FANDOM_RANKING_SLUGS } from "./fandomRankings";
import { TCG_EVERGREEN_RANKING_SLUG } from "./seedTcgEvergreen";
import { MANGA_RANKING_SLUGS } from "./seedMangaRankings";
import { ANIME_RANKING_SLUGS } from "./seedAnimeRankings";
import { GAMING_RANKING_SLUGS } from "./seedGamingRankings";
import { COSPLAY_RANKING_SLUGS } from "./seedCosplayRankings";
import { CREATOR_RANKING_SLUGS } from "./seedCreatorRankings";
import { REQUIRED_RANKING_TITLES } from "./requiredRankings";

// -----------------------------------------------------------------------
// Prune legacy rankings: soft-delete pre-launch rankings that are NOT part
// of the 89 cold-start rankings (50 viral + 15 rivalry + 21 tier-one +
// 3 beauty).
//
// ONE-TIME cleanup, not a standing rule. A ranking is eligible ONLY if it
// was created by the "RepHear Team" system account (every seed script
// attributes to it — this catches seed-created rankings no matter when
// they were seeded, including on a fresh database).
//
// HARD RULE (2026-09-30): user-created rankings are NEVER eligible for
// pruning, regardless of age. There is no date-based fallback — a previous
// version also matched rows created before the 2026-09-24 cold-start
// launch, which could have caught a genuine user-created ranking. That
// fallback is removed: when in doubt, keep the row. An app restart can
// never delete a ranking a user made.
// The datetime() comparison normalizes whatever created_at format a row
// carries; rows with NULL/unparseable created_at fall back to the
// created_by check only (conservative: never delete what we can't date).
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
  ...FANDOM_RANKING_SLUGS,
  // Evergreen TCG successor ranking (seedTcgEvergreen) — must survive
  // pruning like the rest of the current public set.
  TCG_EVERGREEN_RANKING_SLUG,
  // Taxonomy v2 content seeds (2026-09-30): Manga/Anime/Gaming/Cosplay/
  // Digital Creators clusters — must survive pruning like the rest of
  // the current public set.
  ...MANGA_RANKING_SLUGS,
  ...ANIME_RANKING_SLUGS,
  ...GAMING_RANKING_SLUGS,
  ...COSPLAY_RANKING_SLUGS,
  ...CREATOR_RANKING_SLUGS,
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
    const systemUser = await getOrCreateSystemAccount();

    const rows = (await db
      .prepare(
        // created_by = system user ONLY. No date fallback: user-created
        // rankings are never eligible, no matter how old.
        `SELECT id, slug, title FROM rankings
         WHERE deleted_at IS NULL
           AND created_by = ?`
      )
      .all(systemUser.id)) as unknown as DoomedRanking[];

    // A ranking is kept when its slug is in the KEEP set OR its exact
    // title is one of the 134 required dataset titles. The title check
    // matters because canonicalization reuses existing rows WITHOUT
    // renaming their slugs (URLs are preserved): a reused row keeps its
    // original slug, which may not be in KEEP_SLUGS.
    const doomed = rows.filter(
      (r) =>
        (r.slug === null || !KEEP_SLUGS.has(r.slug)) &&
        !REQUIRED_RANKING_TITLES.has(r.title)
    );
    if (doomed.length === 0) return;

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
