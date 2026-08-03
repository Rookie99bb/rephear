import { db } from "./client";
import { newId } from "@/lib/id";
import type { Category } from "@/lib/types";

// Parent Category for a curated/editorial Ranking set (e.g. the London
// niche/subculture launch set — see londonNicheRankings.ts). Most
// Rankings have no Category; this table exists purely to group the ones
// that do. slug is the stable identifier callers key off of — ids are
// never hardcoded/guessed by seed scripts, only ever looked up by slug.
interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  created_at: string;
}

function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    createdAt: row.created_at,
  };
}

export async function findCategoryBySlug(slug: string): Promise<Category | null> {
  const row = (await db
    .prepare("SELECT * FROM categories WHERE slug = ?")
    .get(slug)) as unknown as CategoryRow | undefined;
  return row ? toCategory(row) : null;
}

export async function findCategoryById(id: string): Promise<Category | null> {
  const row = (await db
    .prepare("SELECT * FROM categories WHERE id = ?")
    .get(id)) as unknown as CategoryRow | undefined;
  return row ? toCategory(row) : null;
}

export async function createCategory(params: {
  name: string;
  slug: string;
  description?: string;
}): Promise<Category> {
  const id = newId();
  await db
    .prepare(
      `INSERT INTO categories (id, name, slug, description) VALUES (?, ?, ?, ?)`
    )
    .run(id, params.name.trim(), params.slug.trim(), params.description?.trim() ?? "");
  return (await findCategoryById(id))!;
}

// Idempotent: returns the existing row if the slug is already taken,
// otherwise creates it. Every caller (currently just the London niche
// seed) should use this instead of createCategory directly, so re-runs
// never race a duplicate-slug UNIQUE constraint violation.
export async function findOrCreateCategory(params: {
  name: string;
  slug: string;
  description?: string;
}): Promise<Category> {
  const existing = await findCategoryBySlug(params.slug);
  if (existing) return existing;
  return createCategory(params);
}

export async function listCategories(): Promise<Category[]> {
  const rows = (await db
    .prepare("SELECT * FROM categories ORDER BY name ASC")
    .all()) as unknown as CategoryRow[];
  return rows.map(toCategory);
}

export async function countRankingsInCategory(categoryId: string): Promise<number> {
  const row = (await db
    .prepare("SELECT COUNT(*) as count FROM rankings WHERE category_id = ?")
    .get(categoryId)) as unknown as { count: number } | undefined;
  return row?.count ?? 0;
}
