"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAdmin } from "@/lib/admin";
import {
  softDeleteRanking,
  restoreRanking,
  setRankingHidden,
  findRankingById,
  updateRankingTaxonomy,
} from "@/db/rankings";
import {
  softDeleteNominee,
  restoreNominee,
  findProfileById,
} from "@/db/profiles";
import { recordAuditLog, AUDIT_ACTIONS } from "@/db/auditLog";
import { getRequestContext } from "@/lib/requestContext";
import { findUserById } from "@/db/users";
import { findCategoryById } from "@/db/categories";
import { findSubcategoryById } from "@/db/taxonomy";
import {
  setReportStatus,
  setUserHidden,
} from "@/db/userReports";

export interface ModerationResult {
  error?: string;
}

function revalidateModerationPaths(rankingId: string) {
  revalidatePath("/admin/moderation");
  revalidatePath("/admin/audit");
  revalidatePath("/rankings");
  revalidatePath("/");
  revalidatePath(`/rankings/${rankingId}`);
}

// Soft delete only — see db/rankings.ts. Nominees, Likes, Payments, and
// Credit Transactions belonging to this Ranking are never touched.
export async function softDeleteRankingAction(
  rankingId: string
): Promise<ModerationResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Forbidden." };

  const ranking = await findRankingById(rankingId);
  if (!ranking) return { error: "Ranking not found." };

  await softDeleteRanking(rankingId);
  await recordAuditLog({
    actorUserId: admin.id,
    action: AUDIT_ACTIONS.RANKING_SOFT_DELETED,
    targetType: "ranking",
    targetId: rankingId,
    details: { title: ranking.title },
    ...getRequestContext(),
  });

  revalidateModerationPaths(rankingId);
  return {};
}

export async function restoreRankingAction(
  rankingId: string
): Promise<ModerationResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Forbidden." };

  const ranking = await findRankingById(rankingId);
  if (!ranking) return { error: "Ranking not found." };

  await restoreRanking(rankingId);
  await recordAuditLog({
    actorUserId: admin.id,
    action: AUDIT_ACTIONS.RANKING_RESTORED,
    targetType: "ranking",
    targetId: rankingId,
    details: { title: ranking.title },
    ...getRequestContext(),
  });

  revalidateModerationPaths(rankingId);
  return {};
}

export async function setRankingHiddenAction(
  rankingId: string,
  hidden: boolean
): Promise<ModerationResult> {  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Forbidden." };

  const ranking = await findRankingById(rankingId);
  if (!ranking) return { error: "Ranking not found." };

  await setRankingHidden(rankingId, hidden);
  await recordAuditLog({
    actorUserId: admin.id,
    action: hidden ? AUDIT_ACTIONS.SPAM_HIDDEN : AUDIT_ACTIONS.SPAM_RESTORED,
    targetType: "ranking",
    targetId: rankingId,
    details: { title: ranking.title },
    ...getRequestContext(),
  });

  revalidateModerationPaths(rankingId);
  return {};
}

// Soft delete only — removes the Ranking<->Nominee relationship. The
// underlying Public Profile, and every Like/Payment/Credit Transaction
// recorded for this pairing, are left completely intact.
export async function softDeleteNomineeAction(
  rankingId: string,
  profileId: string
): Promise<ModerationResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Forbidden." };

  const profile = await findProfileById(profileId);
  if (!profile) return { error: "Profile not found." };

  await softDeleteNominee(profileId);
  await recordAuditLog({
    actorUserId: admin.id,
    action: AUDIT_ACTIONS.NOMINEE_SOFT_DELETED,
    targetType: "profile",
    targetId: profileId,
    details: { rankingId, profileId, profileName: profile.name },
    ...getRequestContext(),
  });

  revalidateModerationPaths(rankingId);
  return {};
}

export async function restoreNomineeAction(
  rankingId: string,
  profileId: string
): Promise<ModerationResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Forbidden." };

  const profile = await findProfileById(profileId);
  if (!profile) return { error: "Profile not found." };

  await restoreNominee(profileId);
  await recordAuditLog({
    actorUserId: admin.id,
    action: AUDIT_ACTIONS.NOMINEE_RESTORED,
    targetType: "profile",
    targetId: profileId,
    details: { rankingId, profileId, profileName: profile.name },
    ...getRequestContext(),
  });

  revalidateModerationPaths(rankingId);
  return {};
}

// ── Phase 2 (public identity): user report / block moderation ────────

function revalidateUserModerationPaths(userId: string) {
  revalidatePath("/admin/moderation");
  revalidatePath("/admin/audit");
  revalidatePath(`/u/${userId}`);
}

// Dismiss a report: marks it reviewed. The profile is untouched.
export async function dismissReportAction(
  reportId: string
): Promise<ModerationResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Forbidden." };

  await setReportStatus(reportId, "reviewed");
  revalidatePath("/admin/moderation");
  return {};
}

// Hide a profile: the user renders "This profile is unavailable." to
// everyone and vanishes from supporter lists, taste-match sets, and all
// other identity-adjacent surfaces. Ranking totals are untouched —
// hiding is about identity, never about numbers.
export async function hideUserAction(
  userId: string
): Promise<ModerationResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Forbidden." };

  const target = await findUserById(userId);
  if (!target) return { error: "User not found." };

  await setUserHidden(userId, true);
  await recordAuditLog({
    actorUserId: admin.id,
    action: AUDIT_ACTIONS.USER_HIDDEN,
    targetType: "user",
    targetId: userId,
    details: { userName: target.name },
    ...getRequestContext(),
  });

  revalidateUserModerationPaths(userId);
  return {};
}

export async function unhideUserAction(
  userId: string
): Promise<ModerationResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Forbidden." };

  const target = await findUserById(userId);
  if (!target) return { error: "User not found." };

  await setUserHidden(userId, false);
  await recordAuditLog({
    actorUserId: admin.id,
    action: AUDIT_ACTIONS.USER_UNHIDDEN,
    targetType: "user",
    targetId: userId,
    details: { userName: target.name },
    ...getRequestContext(),
  });

  revalidateUserModerationPaths(userId);
  return {};
}

// Taxonomy v2 (2026-09-30): admin-only reassignment of a ranking's
// category / subcategory / scope / tags. Validates that the category
// and subcategory exist and that the subcategory belongs to the
// category; a null categoryId clears both. Engagement data, nominees,
// covers, and location are never touched here.
export async function updateRankingTaxonomyAction(
  rankingId: string,
  params: {
    categoryId: string | null;
    subcategoryId: string | null;
    scope: "global" | "country" | "city";
    tags: string[];
  }
): Promise<ModerationResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Forbidden." };

  const ranking = await findRankingById(rankingId);
  if (!ranking) return { error: "Ranking not found." };

  let categoryId: string | null = null;
  let subcategoryId: string | null = null;
  if (params.categoryId) {
    const category = await findCategoryById(params.categoryId);
    if (!category) return { error: "Category not found." };
    categoryId = category.id;
    if (params.subcategoryId) {
      const sub = await findSubcategoryById(params.subcategoryId);
      if (!sub) return { error: "Subcategory not found." };
      if (sub.categoryId !== category.id)
        return { error: "Subcategory does not belong to that category." };
      subcategoryId = sub.id;
    }
  }

  const tags = Array.from(
    new Set(
      params.tags
        .map((t) => t.trim().toLowerCase().replace(/\s+/g, "-"))
        .filter((t) => t.length > 0 && t.length <= 40)
    )
  ).slice(0, 12);

  await updateRankingTaxonomy(rankingId, {
    categoryId,
    subcategoryId,
    scope: params.scope,
    tags,
  });
  await recordAuditLog({
    actorUserId: admin.id,
    action: AUDIT_ACTIONS.RANKING_TAXONOMY_UPDATED,
    targetType: "ranking",
    targetId: rankingId,
    details: {
      title: ranking.title,
      categoryId,
      subcategoryId,
      scope: params.scope,
      tags,
    },
    ...getRequestContext(),
  });

  revalidateModerationPaths(rankingId);
  revalidatePath("/admin/rankings");
  return {};
}

// ── Seed Likes Policy (2026-09-30) ───────────────────────────────────
// Explicit editorial operation: applies the versioned fandom seed dataset
// (fandom_launch_v1). Idempotent — a second call is a safe no-op. Never
// runs on boot; only via this admin action or the CLI script.
export async function applyFandomSeedLikesAction(): Promise<
  ModerationResult & {
    version?: string;
    skipped?: boolean;
    reason?: string;
    rankingsSeeded?: number;
    nomineesSeeded?: number;
    totalSeedLikes?: number;
  }
> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Admin access required." };
  const { seedFandomLaunchLikes } = await import("@/db/seedFandomLaunchLikes");
  try {
    const result = await seedFandomLaunchLikes();
    await recordAuditLog({
      actorUserId: admin.id,
      action: AUDIT_ACTIONS.SEED_LIKES_APPLIED,
      targetType: "system",
      targetId: result.version,
      details: {
        version: result.version,
        skipped: result.skipped,
        reason: result.reason,
        rankingsSeeded: result.rankingsSeeded,
        nomineesSeeded: result.nomineesSeeded,
        totalSeedLikes: result.totalSeedLikes,
      },
      ...getRequestContext(),
    });
    revalidatePath("/admin/analytics");
    revalidatePath("/rankings");
    revalidatePath("/");
    return { ...result };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Seed run failed." };
  }
}
