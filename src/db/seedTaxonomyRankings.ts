import { findCategoryBySlug } from "./categories";
import { findSubcategoryBySlug } from "./taxonomy";
import { createRanking, findRankingBySlug } from "./rankings";
import { createProfile, findNomineeByRankingAndName } from "./profiles";
import { findUserByEmail } from "./users";
import { recordAuditLog, AUDIT_ACTIONS } from "./auditLog";
import { db } from "./client";

// -----------------------------------------------------------------------
// Shared idempotent seeder for Taxonomy v2 content (2026-09-30).
//
// Used by seedMangaRankings / seedAnimeRankings / seedGamingRankings /
// seedCosplayRankings / seedCreatorRankings. Every ranking is looked up by
// slug before creation; nominees are matched by (ranking + name).
// Re-running never duplicates or overwrites existing rows.
//
// Conventions for taxonomy seeds:
// - createdBy: the RepHear Team system account (team@rephear.com).
// - isSystemGenerated: true (marks seed-created vs user-created).
// - scope "global": is_global = 1 (displayed as "🌍 Global"). City is
//   still stored as London/United Kingdom — required by
//   hideRankingsOutsideSupportedLocations(), which soft-deletes any
//   ranking whose stored city is not a supported location.
// - scope "city": London, United Kingdom (displayed "📍 London, United
//   Kingdom").
// - NO engagement is ever seeded: no likes, no supports, no views.
//   Nominees are editorial seed data (titles/descriptions), not activity.
// -----------------------------------------------------------------------

export interface TaxonomyNomineeSeed {
  name: string;
  bio?: string;
}

export interface TaxonomyRankingSeed {
  title: string;
  slug: string;
  description: string;
  categorySlug: string;
  subcategorySlug?: string;
  tags?: string[];
  scope: "global" | "country" | "city";
  nominees?: TaxonomyNomineeSeed[];
}

const TEAM_EMAIL = "team@rephear.com";

export async function seedTaxonomyRankings(
  seeds: TaxonomyRankingSeed[]
): Promise<void> {
  try {
    const team = await findUserByEmail(TEAM_EMAIL);
    if (!team) {
      console.warn(`taxonomy seed: system account ${TEAM_EMAIL} not found`);
      return;
    }
    for (const seed of seeds) {
      try {
        const existing = await findRankingBySlug(seed.slug);
        if (existing) continue;

        const category = await findCategoryBySlug(seed.categorySlug);
        if (!category) {
          console.warn(
            `taxonomy seed: unknown category "${seed.categorySlug}" for ranking "${seed.slug}" — skipped`
          );
          continue;
        }
        let subcategoryId: string | undefined;
        if (seed.subcategorySlug) {
          const sub = await findSubcategoryBySlug(seed.subcategorySlug);
          if (!sub) {
            console.warn(
              `taxonomy seed: unknown subcategory "${seed.subcategorySlug}" for ranking "${seed.slug}" — created without subcategory`
            );
          } else {
            subcategoryId = sub.id;
          }
        }

        const ranking = await createRanking({
          title: seed.title,
          slug: seed.slug,
          description: seed.description,
          country: "United Kingdom",
          city: "London",
          createdBy: team.id,
          categoryId: category.id,
          subcategoryId,
          tags: seed.tags ?? [],
          scope: seed.scope,
          isSystemGenerated: true,
        });
        await recordAuditLog({
          actorUserId: team.id,
          action: AUDIT_ACTIONS.RANKING_CREATED,
          targetType: "ranking",
          targetId: ranking.id,
          details: { source: "taxonomy_seed", rankingSlug: seed.slug },
        });

        for (const nominee of seed.nominees ?? []) {
          const dupe = await findNomineeByRankingAndName(
            ranking.id,
            nominee.name
          );
          if (dupe) continue;
          const profile = await createProfile({
            rankingId: ranking.id,
            name: nominee.name,
            bio: nominee.bio ?? "",
            addedBy: team.id,
          });
          await recordAuditLog({
            actorUserId: team.id,
            action: AUDIT_ACTIONS.NOMINEE_CREATED,
            targetType: "profile",
            targetId: profile.id,
            details: {
              source: "taxonomy_seed",
              rankingSlug: seed.slug,
              nomineeName: nominee.name,
            },
          });
        }
      } catch (err) {
        console.warn(
          `taxonomy seed: failed to seed ranking "${seed.slug}":`,
          err instanceof Error ? err.message : err
        );
      }
    }
  } catch (err) {
    console.warn(
      "taxonomy seed: failed:",
      err instanceof Error ? err.message : err
    );
  }
}

// -----------------------------------------------------------------------
// Canonical required-dataset seeder (2026-09-30) — Phases 2-6 + 17 of the
// content spec. Drives off REQUIRED_RANKINGS in requiredRankings.ts (the
// single source of truth for the 134 exact titles).
//
// For each required entry:
//   1. Reuse: find a live ranking with the EXACT title in the entry's
//      category. If the title is unique across the required set, also
//      accept an exact-title match in any other category (covers legacy
//      rows created before the taxonomy existed).
//   2. Canonicalize: the reused row's category / subcategory / scope /
//      tags are set to the spec values. Title and description are NEVER
//      overwritten on user-created rows (Phase 18); a blank description
//      on a system-generated row is filled from the spec.
//   3. Create: if no reusable row exists, create the full spec row
//      (system-generated, zero engagement — Phase 9).
//
// Duplicate titles across categories ("Best Cosplay Photographer" exists
// under both Cosplay and Digital Creators per the spec) are disambiguated
// by category: the first entry in registry order claims the existing row,
// later entries create a new row with their own slug.
// -----------------------------------------------------------------------
export async function seedRequiredRankings(
  categorySlug?: string
): Promise<{ created: number; reused: number }> {
  const result = { created: 0, reused: 0 };
  try {
    const { REQUIRED_RANKINGS } = await import("./requiredRankings");
    const { updateRankingTaxonomy, toRanking } = await import("./rankings");
    const team = await findUserByEmail(TEAM_EMAIL);
    if (!team) {
      console.warn(`required rankings: system account ${TEAM_EMAIL} not found`);
      return result;
    }
    const titleCounts = new Map<string, number>();
    for (const e of REQUIRED_RANKINGS)
      titleCounts.set(e.title, (titleCounts.get(e.title) ?? 0) + 1);
    const entries = categorySlug
      ? REQUIRED_RANKINGS.filter((e) => e.categorySlug === categorySlug)
      : REQUIRED_RANKINGS;

    for (const entry of entries) {
      try {
        const category = await findCategoryBySlug(entry.categorySlug);
        if (!category) {
          console.warn(
            `required rankings: unknown category "${entry.categorySlug}" for "${entry.title}" — skipped`
          );
          continue;
        }
        const sub = entry.subcategorySlug
          ? await findSubcategoryBySlug(entry.subcategorySlug)
          : null;
        if (entry.subcategorySlug && !sub) {
          console.warn(
            `required rankings: unknown subcategory "${entry.subcategorySlug}" for "${entry.title}" — created without subcategory`
          );
        }

        // 1. Exact title + category match (handles intentional duplicates).
        let row = (await db
          .prepare(
            "SELECT * FROM rankings WHERE title = ? AND category_id = ? AND deleted_at IS NULL"
          )
          .get(entry.title, category.id)) as unknown as
          | import("./rankings").RankingRow
          | undefined;
        // 2. Exact title anywhere — only when the title is unique across
        // the required set (avoids stealing a row claimed by another
        // required entry in a different category).
        if (!row && titleCounts.get(entry.title) === 1) {
          row = (await db
            .prepare(
              "SELECT * FROM rankings WHERE title = ? AND deleted_at IS NULL"
            )
            .get(entry.title)) as unknown as
            | import("./rankings").RankingRow
            | undefined;
        }

        if (row) {
          await updateRankingTaxonomy(row.id, {
            categoryId: category.id,
            subcategoryId: sub ? sub.id : null,
            scope: entry.scope,
            tags: entry.tags,
          });
          const ranking = toRanking(row);
          if (!ranking.description.trim() && ranking.isSystemGenerated) {
            await db
              .prepare("UPDATE rankings SET description = ? WHERE id = ?")
              .run(entry.description, row.id);
          }
          result.reused++;
        } else {
          let slug = entry.slug;
          if (await findRankingBySlug(slug)) {
            const { newId } = await import("@/lib/id");
            slug = `${slug}-${newId().slice(0, 6)}`;
          }
          const ranking = await createRanking({
            title: entry.title,
            slug,
            description: entry.description,
            country: entry.country ?? "United Kingdom",
            city: entry.city ?? "London",
            createdBy: team.id,
            categoryId: category.id,
            subcategoryId: sub?.id,
            tags: entry.tags,
            scope: entry.scope,
            isSystemGenerated: true,
          });
          await recordAuditLog({
            actorUserId: team.id,
            action: AUDIT_ACTIONS.RANKING_CREATED,
            targetType: "ranking",
            targetId: ranking.id,
            details: { source: "required_dataset", rankingSlug: slug },
          });
          result.created++;
        }
      } catch (err) {
        console.warn(
          `required rankings: failed on "${entry.title}":`,
          err instanceof Error ? err.message : err
        );
      }
    }
  } catch (err) {
    console.warn(
      "required rankings seeding failed:",
      err instanceof Error ? err.message : err
    );
  }
  return result;
}
