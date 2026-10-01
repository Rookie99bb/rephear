import { db } from "./client";
import { findRankingById } from "./rankings";
import type { Ranking } from "@/lib/types";

// Admin homepage curation: manual ranking picks for the two homepage
// surfaces. Manual-first semantics: curated picks occupy the first
// slots in position order; the existing automatic logic fills whatever
// slots remain. The two surfaces are fully independent of each other.
// Public UI is untouched — curation only swaps the data source.
//
// Surfaces:
//   trending — "Trending in London", up to 3 manual picks
//   rising   — "Rising Now",       up to 6 manual picks
export const CURATION_SURFACES = {
  trending: { maxPicks: 3, label: "Trending in London" },
  rising: { maxPicks: 6, label: "Rising Now" },
} as const;

export type CurationSurface = keyof typeof CURATION_SURFACES;

export function isCurationSurface(value: string): value is CurationSurface {
  return value === "trending" || value === "rising";
}

export interface ManualPick {
  rankingId: string;
  position: number;
}

/** Idempotent DDL; called from ensureMigrated() on every boot. */
export async function ensureCurationTable(): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS homepage_curation (
        surface TEXT NOT NULL,
        ranking_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (surface, ranking_id)
      )`,
    )
    .run();
  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_homepage_curation_surface
       ON homepage_curation (surface, position)`,
    )
    .run();
}

/** Raw manual picks for a surface, ordered by position (1-based). */
export async function getManualCuration(
  surface: CurationSurface,
): Promise<ManualPick[]> {
  const rows = await db
    .prepare(
      `SELECT ranking_id AS rankingId, position
       FROM homepage_curation
       WHERE surface = ?
       ORDER BY position ASC`,
    )
    .all<{ rankingId: string; position: number }>(surface);
  return rows.map((r) => ({ rankingId: r.rankingId, position: r.position }));
}

/**
 * Replace the manual picks for a surface. Throws on:
 * - unknown surface
 * - more ids than the surface allows
 * - an id that doesn't resolve to a *public* ranking (hidden /
 *   soft-deleted / archived rankings can never be curated onto the
 *   homepage)
 * Empty strings and duplicates are dropped (first occurrence wins).
 */
export async function setManualCuration(
  surface: CurationSurface,
  rankingIds: string[],
): Promise<ManualPick[]> {
  if (!isCurationSurface(surface)) {
    throw new Error(`Unknown curation surface: ${surface}`);
  }
  const maxPicks = CURATION_SURFACES[surface].maxPicks;
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const raw of rankingIds) {
    const id = (raw ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    deduped.push(id);
  }
  if (deduped.length > maxPicks) {
    throw new Error(
      `${CURATION_SURFACES[surface].label} allows at most ${maxPicks} manual picks`,
    );
  }
  for (const id of deduped) {
    const ranking = await findRankingById(id);
    if (!ranking || ranking.isHidden || ranking.deletedAt || ranking.isArchived) {
      throw new Error(`Ranking ${id} is not public and cannot be curated`);
    }
  }
  // Transactional replace: the surface is never left half-written.
  await db.prepare("DELETE FROM homepage_curation WHERE surface = ?").run(surface);
  let position = 0;
  for (const id of deduped) {
    position += 1;
    await db
      .prepare(
        `INSERT INTO homepage_curation (surface, ranking_id, position)
         VALUES (?, ?, ?)`,
      )
      .run(surface, id, position);
  }
  return getManualCuration(surface);
}

/** Remove all manual picks for a surface (automatic logic takes over). */
export async function clearManualCuration(
  surface: CurationSurface,
): Promise<void> {
  if (!isCurationSurface(surface)) {
    throw new Error(`Unknown curation surface: ${surface}`);
  }
  await db.prepare("DELETE FROM homepage_curation WHERE surface = ?").run(surface);
}

/**
 * Manual picks resolved to public Ranking objects, in position order.
 * A pick whose ranking has since become non-public is silently skipped
 * (never rendered); use getManualCuration() for the raw admin view.
 */
export async function getManualCuratedRankings(
  surface: CurationSurface,
): Promise<Ranking[]> {
  const picks = await getManualCuration(surface);
  const rankings: Ranking[] = [];
  for (const pick of picks) {
    const ranking = await findRankingById(pick.rankingId);
    if (ranking && !ranking.isHidden && !ranking.deletedAt && !ranking.isArchived) {
      rankings.push(ranking);
    }
  }
  return rankings;
}
