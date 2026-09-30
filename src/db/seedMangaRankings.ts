// -----------------------------------------------------------------------
// Manga content seed (2026-09-30) — thin wrapper over the canonical
// required dataset in requiredRankings.ts (the single source of truth
// for the spec's exact titles). See seedRequiredRankings() in
// seedTaxonomyRankings.ts for the reuse/canonicalize/create logic.
// -----------------------------------------------------------------------
import { REQUIRED_RANKINGS } from "./requiredRankings";
import { seedRequiredRankings } from "./seedTaxonomyRankings";

export const MANGA_RANKING_SLUGS = REQUIRED_RANKINGS.filter(
  (r) => r.categorySlug === "manga"
).map((r) => r.slug);

export async function seedMangaRankings(): Promise<void> {
  await seedRequiredRankings("manga");
}
