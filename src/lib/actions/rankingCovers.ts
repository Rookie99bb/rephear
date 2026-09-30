"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAdmin } from "@/lib/admin";
import {
  setRankingCover,
  setCoverLocked,
  setRankingGlobal,
  findRankingById,
  logCoverRefresh,
} from "@/db/rankings";
import { recordAuditLog } from "@/db/auditLog";
import { getMostLoved } from "@/db/leaderboards";
import {
  decideCoverRefresh,
  getRankingCategorySlug,
} from "@/services/ranking-images/rankingCoverService";
import { getCategoryFallbackCard } from "@/services/ranking-images/categoryFallbacks";
import { isUsableCoverUrl } from "@/services/ranking-images/provider";

export interface CoverActionResult {
  error?: string;
}

function revalidateCoverPaths(rankingId: string) {
  revalidatePath("/rankings");
  revalidatePath(`/rankings/${rankingId}`);
  revalidatePath("/admin/rankings");
  revalidatePath("/");
}

async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Admin access required." } as const;
  return { admin } as const;
}

// Admin uploads/replaces a cover: status becomes 'manual' so the weekly
// job never overwrites it.
export async function setManualCoverAction(
  rankingId: string,
  url: string,
  alt?: string
): Promise<CoverActionResult> {
  const gate = await requireAdmin();
  if ("error" in gate) return { error: gate.error };
  const ranking = await findRankingById(rankingId);
  if (!ranking) return { error: "Ranking not found." };
  const clean = url.trim();
  if (!isUsableCoverUrl(clean)) return { error: "That doesn't look like a valid image URL." };
  await setRankingCover(rankingId, {
    url: clean,
    source: "manual",
    alt: alt?.trim() || `${ranking.title} — RepHear ranking`,
    status: "manual",
  });
  await recordAuditLog({
    actorUserId: gate.admin.id,
    action: "ranking_cover_updated",
    targetType: "ranking",
    targetId: rankingId,
    details: { url: clean, source: "manual" },
  }).catch(() => {});
  revalidateCoverPaths(rankingId);
  return {};
}

// Lock (manual) / unlock (back to automatic) a cover.
export async function setCoverLockedAction(
  rankingId: string,
  locked: boolean
): Promise<CoverActionResult> {
  const gate = await requireAdmin();
  if ("error" in gate) return { error: gate.error };
  const ranking = await findRankingById(rankingId);
  if (!ranking) return { error: "Ranking not found." };
  await setCoverLocked(rankingId, locked);
  revalidateCoverPaths(rankingId);
  return {};
}

// Run the weekly decision logic for one ranking right now (admin
// "Refresh automatically"). Never touches manual covers.
export async function refreshCoverNowAction(
  rankingId: string
): Promise<CoverActionResult & { changed?: boolean; reason?: string }> {
  const gate = await requireAdmin();
  if ("error" in gate) return { error: gate.error };
  const ranking = await findRankingById(rankingId);
  if (!ranking) return { error: "Ranking not found." };
  if (ranking.coverImageStatus === "manual") {
    return { error: "Cover is locked (manual) — unlock it first." };
  }
  let topNomineePhotoUrls: string[] = [];
  try {
    const loved = await getMostLoved(rankingId);
    const r2Base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
    topNomineePhotoUrls = loved
      .slice(0, 3)
      .map((e) => e.profile.photoUrl?.trim() || "")
      .filter((u) => u && (u.startsWith("/") || (r2Base ? u.startsWith(r2Base) : false)));
  } catch {
    topNomineePhotoUrls = [];
  }
  const decision = await decideCoverRefresh(ranking, {
    topNomineePhotoUrls,
    isRising: false,
    isNew: false,
    coverAgeDays: 0,
  });
  const runId = `admin-${Date.now()}`;
  if (!decision.shouldRefresh || !decision.candidate) {
    await logCoverRefresh({
      rankingId,
      runId,
      oldImage: ranking.coverImageUrl,
      newImage: ranking.coverImageUrl,
      source: ranking.coverImageSource,
      reason: "unchanged",
      status: "unchanged",
    });
    return { changed: false, reason: "unchanged" };
  }
  const candidate = decision.candidate;
  if (candidate.source === "category-fallback") {
    candidate.url = getCategoryFallbackCard(await getRankingCategorySlug(ranking));
  }
  await setRankingCover(rankingId, {
    url: candidate.url,
    source: candidate.source,
    alt: candidate.alt,
    status: "active",
  });
  await logCoverRefresh({
    rankingId,
    runId,
    oldImage: ranking.coverImageUrl,
    newImage: candidate.url,
    source: candidate.source,
    reason: decision.reason as "better_candidate",
    status: "changed",
  });
  revalidateCoverPaths(rankingId);
  return { changed: true, reason: decision.reason };
}

// Restore the category fallback art (stays on automatic refresh —
// unlike a manual upload, the weekly job may replace it later).
export async function restoreCategoryFallbackAction(
  rankingId: string
): Promise<CoverActionResult> {
  const gate = await requireAdmin();
  if ("error" in gate) return { error: gate.error };
  const ranking = await findRankingById(rankingId);
  if (!ranking) return { error: "Ranking not found." };
  const slug = await getRankingCategorySlug(ranking);
  const url = getCategoryFallbackCard(slug);
  const oldImage = ranking.coverImageUrl;
  await setRankingCover(rankingId, {
    url,
    source: "category-fallback",
    alt: `${ranking.title} — RepHear ranking`,
    status: "active",
  });
  await logCoverRefresh({
    rankingId,
    runId: `admin-${Date.now()}`,
    oldImage,
    newImage: url,
    source: "category-fallback",
    reason: "fallback",
    status: "changed",
  });
  revalidateCoverPaths(rankingId);
  return {};
}

// Toggle the global-scope flag ("Global" vs "City, Country" label).
export async function setRankingGlobalAction(
  rankingId: string,
  isGlobal: boolean
): Promise<CoverActionResult> {
  const gate = await requireAdmin();
  if ("error" in gate) return { error: gate.error };
  const ranking = await findRankingById(rankingId);
  if (!ranking) return { error: "Ranking not found." };
  await setRankingGlobal(rankingId, isGlobal);
  revalidateCoverPaths(rankingId);
  return {};
}
