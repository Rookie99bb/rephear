"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAdmin } from "@/lib/admin";
import {
  setRankingPinned,
  reorderRankingsInCity,
  findRankingById,
} from "@/db/rankings";
import { recordAuditLog, AUDIT_ACTIONS } from "@/db/auditLog";
import { getRequestContext } from "@/lib/requestContext";

export interface RankingAdminResult {
  error?: string;
}

function revalidateRankingAdminPaths(rankingId?: string) {
  revalidatePath("/admin/rankings");
  revalidatePath("/admin/audit");
  revalidatePath("/rankings");
  revalidatePath("/");
  if (rankingId) revalidatePath(`/rankings/${rankingId}`);
}

// Toggles is_pinned only. Never touches is_hidden or display_order — a
// Ranking's position within its pinned/unpinned group is decided
// separately by reorderRankingsAction below (or wherever it already sat).
export async function setRankingPinnedAction(
  rankingId: string,
  pinned: boolean
): Promise<RankingAdminResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Forbidden." };

  const ranking = await findRankingById(rankingId);
  if (!ranking) return { error: "Ranking not found." };

  await setRankingPinned(rankingId, pinned);
  await recordAuditLog({
    actorUserId: admin.id,
    action: pinned ? AUDIT_ACTIONS.RANKING_PINNED : AUDIT_ACTIONS.RANKING_UNPINNED,
    targetType: "ranking",
    targetId: rankingId,
    details: { title: ranking.title, city: ranking.city },
    ...getRequestContext(),
  });

  revalidateRankingAdminPaths(rankingId);
  return {};
}

// Persists a new drag-and-drop order for one city's Rankings board.
// orderedIds must be every Ranking id currently visible in that city's
// admin list (pinned and unpinned mixed together, in their new top-to-
// bottom order) — reorderRankingsInCity() itself re-checks city on every
// row it updates, so even a mismatched id list can't bleed into another
// city's ordering. is_pinned is left completely alone here; moving a card
// never auto-pins or auto-unpins it.
export async function reorderRankingsAction(
  city: string,
  orderedIds: string[]
): Promise<RankingAdminResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Forbidden." };
  if (!city.trim()) return { error: "City is required." };
  if (orderedIds.length === 0) return {};

  await reorderRankingsInCity(city, orderedIds);
  await recordAuditLog({
    actorUserId: admin.id,
    action: AUDIT_ACTIONS.RANKING_REORDERED,
    targetType: "ranking",
    targetId: orderedIds[0],
    details: { city, orderedIds },
    ...getRequestContext(),
  });

  revalidateRankingAdminPaths();
  return {};
}
