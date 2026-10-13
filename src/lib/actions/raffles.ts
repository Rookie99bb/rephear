"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAdmin } from "@/lib/admin";
import {
  createRaffle,
  drawRaffleWinners,
  cancelRaffle,
  findRaffleById,
  checkInToRaffle,
} from "@/db/raffles";
import { getCurrentUser } from "@/lib/session";
import { findRankingById } from "@/db/rankings";
import { findUserById } from "@/db/users";
import { recordAuditLog, AUDIT_ACTIONS } from "@/db/auditLog";
import { getRequestContext } from "@/lib/requestContext";

export interface RaffleActionResult {
  error?: string;
  success?: boolean;
  raffleId?: string;
}

export async function checkInToRaffleAction(
  raffleId: string,
  _prev: RaffleActionResult
): Promise<RaffleActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Log in to complete Draw Check-in." };
  try {
    await checkInToRaffle({ raffleId, userId: user.id });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Draw Check-in failed.",
    };
  }
  revalidatePath(`/draws/${raffleId}`);
  return { success: true, raffleId };
}

function parseDateInput(raw: string): string | null {
  // Admin campaign times are explicitly UK time. Render runs in UTC, so a
  // bare datetime-local value must not be interpreted in the server zone.
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(raw);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  const wallUtc = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4]);
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(wallUtc));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(formatted.find((part) => part.type === type)?.value);
  const representedUtc = Date.UTC(
    value("year"), value("month") - 1, value("day"), value("hour"), value("minute")
  );
  return new Date(wallUtc - (representedUtc - wallUtc)).toISOString();
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
  const startsAtRaw = String(formData.get("startsAt") || "").trim();
  const drawAtRaw = String(formData.get("drawAt") || "").trim();
  const rankingIds = formData
    .getAll("rankingIds")
    .map(String)
    .map((value) => value.trim())
    .filter(Boolean);
  const winnerCountRaw = String(formData.get("winnerCount") || "1").trim();

  if (!title) return { error: "Title is required." };
  if (!prizeDescription) return { error: "Prize description is required." };
  const endsAt = parseDateInput(endsAtRaw);
  const startsAt = parseDateInput(startsAtRaw);
  const drawAt = parseDateInput(drawAtRaw);
  if (!startsAt) return { error: "Enter a valid voting close/check-in start time." };
  if (!endsAt) return { error: "Enter a valid end date and time." };
  if (!drawAt) return { error: "Enter a valid draw time." };
  if (new Date(startsAt).getTime() >= new Date(endsAt).getTime())
    return { error: "Check-in must close after it opens." };
  if (new Date(endsAt).getTime() >= new Date(drawAt).getTime())
    return { error: "The draw must start after Check-in closes." };
  const noticeWindow = new Date(drawAt).getTime() - new Date(startsAt).getTime();
  if (noticeWindow !== 24 * 60 * 60 * 1000)
    return { error: "Draw Check-in must open exactly 24 hours before the draw." };
  if (rankingIds.length < 3)
    return { error: "Select at least three campaign Rankings." };
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
  for (const selectedRankingId of rankingIds) {
    if (!(await findRankingById(selectedRankingId))) {
      return { error: "One of the selected Rankings no longer exists." };
    }
  }

  const raffle = await createRaffle({
    title,
    description,
    rankingId,
    prizeDescription,
    sponsorName,
    startsAt,
    endsAt,
    drawAt,
    rankingIds,
    winnerCount,
    createdBy: admin.id,
  });

  const { ipAddress, userAgent } = getRequestContext();
  await recordAuditLog({
    actorUserId: admin.id,
    action: AUDIT_ACTIONS.RAFFLE_CREATED,
    targetType: "raffle",
    targetId: raffle.id,
    details: { title, rankingId, rankingIds, prizeDescription, winnerCount, startsAt, endsAt, drawAt },
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
