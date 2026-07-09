"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAdmin } from "@/lib/admin";
import {
  softDeleteRanking,
  restoreRanking,
  setRankingHidden,
  findRankingById,
} from "@/db/rankings";
import {
  softDeleteNominee,
  restoreNominee,
  findProfileById,
} from "@/db/profiles";
import { recordAuditLog, AUDIT_ACTIONS } from "@/db/auditLog";
import { getRequestContext } from "@/lib/requestContext";

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

  const ranking = findRankingById(rankingId);
  if (!ranking) return { error: "Ranking not found." };

  softDeleteRanking(rankingId);
  recordAuditLog({
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

  const ranking = findRankingById(rankingId);
  if (!ranking) return { error: "Ranking not found." };

  restoreRanking(rankingId);
  recordAuditLog({
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
): Promise<ModerationResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Forbidden." };

  const ranking = findRankingById(rankingId);
  if (!ranking) return { error: "Ranking not found." };

  setRankingHidden(rankingId, hidden);
  recordAuditLog({
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

  const profile = findProfileById(profileId);
  if (!profile) return { error: "Profile not found." };

  softDeleteNominee(profileId);
  recordAuditLog({
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

  const profile = findProfileById(profileId);
  if (!profile) return { error: "Profile not found." };

  restoreNominee(profileId);
  recordAuditLog({
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
