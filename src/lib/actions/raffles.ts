"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAdmin } from "@/lib/admin";
import {
  createRaffle,
  drawRaffleWinners,
  cancelRaffle,
  findRaffleById,
} from "@/db/raffles";
import { findRankingById } from "@/db/rankings";
import { findUserById } from "@/db/users";
import { recordAuditLog, AUDIT_ACTIONS } from "@/db/auditLog";
import { getRequestContext } from "@/lib/requestContext";

export interface RaffleActionResult {
  error?: string;
  success?: boolean;
  raffleId?: string;
}

function parseDateInput(raw: string): string | null {
  // <input type="datetime-local"> gives "YYYY-MM-DDTHH:MM" (local time).
  // Store as UTC ISO; SQLite datetime() comparisons in
  // listActiveRafflesForRanking use UTC, so keep everything in UTC.
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// Admin-only: create a new prize draw. Validates every field server-side;
// the form is just a convenience, never trusted.
export async function createRaffleAction(
  _prev: RaffleActionResult,
  formData: FormData
): Promise<RaffleActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Admin access required." };

  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const rankingIdRaw = String(formData.get("rankingId") || "").trim();
  const prizeDescription = String(formData.get("prizeDescription") || "").trim();
  const sponsorName = String(formData.get("sponsorName") || "").trim();
  const endsAtRaw = String(formData.get("endsAt") || "").trim();
  const winnerCountRaw = String(formData.get("winnerCount") || "1").trim();

  if (!title) return { error: "Title is required." };
  if (!prizeDescription) return { error: "Prize description is required." };
  const endsAt = parseDateInput(endsAtRaw);
  if (!endsAt) return { error: "Enter a valid end date and time." };
  if (new Date(endsAt).getTime() <= Date.now()) {
    return { error: "End time must be in the future." };
  }
  const winnerCount = Number.parseInt(winnerCountRaw, 10);
  if (!Number.isInteger(winnerCount) || winnerCount < 1 || winnerCount > 100) {
    return { error: "Winner count must be between 1 and 100." };
  }

  let rankingId: string | null = null;
  if (rankingIdRaw) {
    const ranking = await findRankingById(rankingIdRaw);
    if (!ranking) return { error: "Ranking not found." };
    rankingId = ranking.id;
  }

  const raffle = await createRaffle({
    title,
    description,
    rankingId,
    prizeDescription,
    sponsorName,
    endsAt,
    winnerCount,
    createdBy: admin.id,
  });

  const { ipAddress, userAgent } = getRequestContext();
  await recordAuditLog({
    actorUserId: admin.id,
    action: AUDIT_ACTIONS.RAFFLE_CREATED,
    targetType: "raffle",
    targetId: raffle.id,
    details: { title, rankingId, prizeDescription, winnerCount, endsAt },
    ipAddress,
    userAgent,
  });

  revalidatePath("/admin/raffles");
  return { success: true, raffleId: raffle.id };
}

// Admin-only: draw winners for an ended raffle. The draw itself
// (random selection + status flip to 'drawn') happens in
// drawRaffleWinners, which refuses to run twice; this action just wraps
// it with auth + audit logging.
export async function drawRaffleAction(
  raffleId: string
): Promise<RaffleActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Admin access required." };

  const raffle = await findRaffleById(raffleId);
  if (!raffle) return { error: "Raffle not found." };

  let winners;
  try {
    winners = await drawRaffleWinners(raffleId, admin.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Draw failed." };
  }

  const winnerNames: string[] = [];
  for (const w of winners) {
    const u = await findUserById(w.userId);
    winnerNames.push(u?.name || u?.email || w.userId);
  }

  const { ipAddress, userAgent } = getRequestContext();
  await recordAuditLog({
    actorUserId: admin.id,
    action: AUDIT_ACTIONS.RAFFLE_DRAWN,
    targetType: "raffle",
    targetId: raffleId,
    details: {
      title: raffle.title,
      winnerIds: winners.map((w) => w.userId),
      winnerNames,
    },
    ipAddress,
    userAgent,
  });

  revalidatePath("/admin/raffles");
  revalidatePath(`/admin/raffles/${raffleId}`);
  return { success: true };
}

// Admin-only: cancel a raffle that hasn't been drawn (e.g. sponsor
// pulled out). Entries are kept for the record; the raffle simply
// stops accepting new ones and can never be drawn.
export async function cancelRaffleAction(
  raffleId: string
): Promise<RaffleActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Admin access required." };

  await cancelRaffle(raffleId);

  const { ipAddress, userAgent } = getRequestContext();
  await recordAuditLog({
    actorUserId: admin.id,
    action: AUDIT_ACTIONS.RAFFLE_CANCELLED,
    targetType: "raffle",
    targetId: raffleId,
    details: {},
    ipAddress,
    userAgent,
  });

  revalidatePath("/admin/raffles");
  revalidatePath(`/admin/raffles/${raffleId}`);
  return { success: true };
}
