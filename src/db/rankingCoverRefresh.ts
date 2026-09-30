// Weekly ranking cover refresh job.
//
// Runs every Monday at 04:00 Europe/London (see
// src/app/api/cron/ranking-covers/route.ts — triggered by the external
// scheduler with the shared CRON_SECRET).
//
// The job CHECKS every eligible ranking each week but only REPLACES a
// cover when something meaningful changed (top nominees changed,
// trending, stale, broken source, materially better candidate).
// Manual/admin-locked covers (cover_image_status = 'manual') are never
// touched. Every check is logged to ranking_cover_refresh_log so admins
// can see why an image changed.
//
// Covers are presentation-only: this job never affects ranking scores,
// Most Loved / Most Supported calculations, Support Credits, nominee
// order, or eligibility.

import { newId } from "@/lib/id";
import { db } from "./client";
import {
  toRanking,
  setRankingCover,
  logCoverRefresh,
  type RankingRow,
  type CoverRefreshReason,
} from "./rankings";
import { getRisingRankings, getNewRankings, getMostActiveRankings } from "./discovery";
import { getMostLoved } from "./leaderboards";
import {
  decideCoverRefresh,
  getRankingCategorySlug,
} from "@/services/ranking-images/rankingCoverService";
import { getCategoryFallbackCard } from "@/services/ranking-images/categoryFallbacks";
import { isUsableCoverUrl } from "@/services/ranking-images/provider";
import type { Ranking } from "@/lib/types";

export interface CoverRefreshRunResult {
  runId: string;
  checked: number;
  changed: number;
  unchanged: number;
  skippedManual: number;
  errors: number;
  changes: { rankingId: string; title: string; reason: string }[];
}

// All public, non-deleted, non-archived rankings are eligible.
async function getEligibleRankings(): Promise<(Ranking & { categorySlug: string | null })[]> {
  const rows = (await db
    .prepare(
      `SELECT r.*, c.slug AS category_slug FROM rankings r
       LEFT JOIN categories c ON c.id = r.category_id
       WHERE r.deleted_at IS NULL AND r.is_hidden = 0 AND COALESCE(r.is_archived, 0) = 0
       ORDER BY r.created_at DESC`
    )
    .all()) as unknown as (RankingRow & { category_slug: string | null })[];
  return rows.map((r) => ({ ...toRanking(r), categorySlug: r.category_slug }));
}

// Cover priority per taxonomy spec (2026-09-30): the fandom cluster
// gets cover attention first — Anime > Gaming > Manga > Cosplay >
// Digital Creators > everything else. Applied as the secondary sort
// key inside each freshness tier (Rising > most active > new > rest),
// so trending still wins but the fandom cluster is served first among
// equally-fresh rankings.
const CATEGORY_COVER_PRIORITY: Record<string, number> = {
  anime: 0,
  gaming: 1,
  manga: 2,
  cosplay: 3,
  "digital-creators": 4,
};
function categoryCoverPriority(slug: string | null): number {
  if (slug && slug in CATEGORY_COVER_PRIORITY) return CATEGORY_COVER_PRIORITY[slug];
  return 5;
}

function coverAgeDays(ranking: Ranking): number {
  if (!ranking.coverImageUpdatedAt) return Infinity;
  const t = Date.parse(ranking.coverImageUpdatedAt);
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
}

function isNewRanking(ranking: Ranking): boolean {
  const t = Date.parse(ranking.createdAt);
  if (Number.isNaN(t)) return false;
  return Date.now() - t < 30 * 24 * 60 * 60 * 1000;
}

export async function weeklyRankingCoverRefresh(): Promise<CoverRefreshRunResult> {
  const runId = newId();
  const result: CoverRefreshRunResult = {
    runId,
    checked: 0,
    changed: 0,
    unchanged: 0,
    skippedManual: 0,
    errors: 0,
    changes: [],
  };

  const rankings = await getEligibleRankings();
  // Priority tiers: Rising first, then most active (all-time), then
  // new, then the remaining eligible rankings — exactly the order the
  // spec asks for.
  const [rising, active, fresh] = await Promise.all([
    getRisingRankings(12),
    getMostActiveRankings(24),
    getNewRankings(50),
  ]);
  const risingIds = new Set(rising.map((r) => r.ranking.id));
  const activeIds = new Set(active.map((r) => r.id));
  const newIds = new Set(fresh.map((r) => r.id));
  const tier = (id: string) =>
    risingIds.has(id) ? 0 : activeIds.has(id) ? 1 : newIds.has(id) ? 2 : 3;
  const ordered = [...rankings].sort(
    (a, b) =>
      tier(a.id) - tier(b.id) ||
      categoryCoverPriority(a.categorySlug) - categoryCoverPriority(b.categorySlug)
  );

  for (const ranking of ordered) {
    result.checked++;
    try {
      if (ranking.coverImageStatus === "manual") {
        result.skippedManual++;
        await logCoverRefresh({
          rankingId: ranking.id,
          runId,
          oldImage: ranking.coverImageUrl,
          newImage: ranking.coverImageUrl,
          source: ranking.coverImageSource,
          reason: "skipped_manual",
          status: "skipped",
        });
        continue;
      }

      // Top nominee photos (self-hosted only — same rule as the
      // provider layer).
      let topNomineePhotoUrls: string[] = [];
      try {
        const loved = await getMostLoved(ranking.id);
        const r2Base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
        topNomineePhotoUrls = loved
          .slice(0, 3)
          .map((e) => e.profile.photoUrl?.trim() || "")
          .filter(
            (u) =>
              u &&
              (u.startsWith("/") || (r2Base ? u.startsWith(r2Base) : false))
          );
      } catch {
        topNomineePhotoUrls = [];
      }

      const decision = await decideCoverRefresh(ranking, {
        topNomineePhotoUrls,
        isRising: risingIds.has(ranking.id),
        isNew: newIds.has(ranking.id) || isNewRanking(ranking),
        coverAgeDays: coverAgeDays(ranking),
      });

      if (!decision.shouldRefresh || !decision.candidate) {
        result.unchanged++;
        await logCoverRefresh({
          rankingId: ranking.id,
          runId,
          oldImage: ranking.coverImageUrl,
          newImage: ranking.coverImageUrl,
          source: ranking.coverImageSource,
          reason: "unchanged",
          status: "unchanged",
        });
        continue;
      }

      const candidate = decision.candidate;
      // Final safety: resolve the category slug for fallback candidates.
      if (candidate.source === "category-fallback") {
        const slug = await getRankingCategorySlug(ranking);
        candidate.url = getCategoryFallbackCard(slug);
      }
      if (!isUsableCoverUrl(candidate.url)) {
        throw new Error(`No usable cover candidate for ranking ${ranking.id}`);
      }

      const oldImage = ranking.coverImageUrl;
      await setRankingCover(ranking.id, {
        url: candidate.url,
        source: candidate.source,
        alt: candidate.alt,
        status: "active",
      });
      result.changed++;
      result.changes.push({
        rankingId: ranking.id,
        title: ranking.title,
        reason: decision.reason,
      });
      await logCoverRefresh({
        rankingId: ranking.id,
        runId,
        oldImage,
        newImage: candidate.url,
        source: candidate.source,
        reason: decision.reason as CoverRefreshReason,
        status: "changed",
      });
    } catch (err) {
      result.errors++;
      await logCoverRefresh({
        rankingId: ranking.id,
        runId,
        oldImage: ranking.coverImageUrl,
        newImage: null,
        source: null,
        reason: "unchanged",
        status: "skipped",
      }).catch(() => {});
      console.error(`[cover-refresh] ranking ${ranking.id} failed:`, err);
    }
  }

  return result;
}
