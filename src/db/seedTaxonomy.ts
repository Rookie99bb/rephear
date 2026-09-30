import { db } from "./client";
import { findOrCreateCategory } from "./categories";
import { findOrCreateSubcategory, TAXONOMY } from "./taxonomy";

// -----------------------------------------------------------------------
// Taxonomy v2 seed (2026-09-30): creates the 13 primary categories and
// their subcategories from the canonical TAXONOMY definition in
// taxonomy.ts.
//
// Idempotent: every Category and Subcategory is looked up by its slug
// before being created (findOrCreateCategory / findOrCreateSubcategory),
// so running any number of times — which happens automatically on every
// app start via ensureMigrated(), same as every other seed step —
// creates each row at most once and never duplicates or overwrites.
//
// Runs BEFORE migrateTaxonomyToV2() in ensureMigrated() so the migration
// can resolve every new category/subcategory slug it remaps onto.
// -----------------------------------------------------------------------
// Canonical identity is authoritative for the 13 spec categories: if an
// older seed file already created one of these slugs with a legacy name
// (e.g. "music" = "Underground Music"), the name/description are reset
// to the canonical spec values here. Only canonical slugs are touched.
async function ensureCanonicalCategoryIdentity(
  id: string,
  name: string,
  description: string
): Promise<void> {
  await db
    .prepare("UPDATE categories SET name = ?, description = ? WHERE id = ?")
    .run(name, description, id);
}

export async function seedTaxonomy(): Promise<void> {
  try {
    for (const categorySeed of TAXONOMY) {
      const category = await findOrCreateCategory({
        name: categorySeed.name,
        slug: categorySeed.slug,
        description: categorySeed.description ?? "",
      });

      await ensureCanonicalCategoryIdentity(
        category.id,
        categorySeed.name,
        categorySeed.description ?? ""
      );

      let order = 0;
      for (const sub of categorySeed.subcategories) {
        order += 1;
        await findOrCreateSubcategory({
          categoryId: category.id,
          name: sub.name,
          slug: sub.slug,
          description: sub.description ?? "",
          sortOrder: order,
        });
      }
    }
  } catch (err) {
    console.warn(
      "Taxonomy v2 seeding failed:",
      err instanceof Error ? err.message : err
    );
  }
}
