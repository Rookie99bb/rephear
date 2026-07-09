"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { addLike } from "@/db/likes";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit";

export async function likeAction(
  rankingId: string,
  profileId: string
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "You must be logged in to Like a nominee." };
  }

  if (!checkRateLimit(`like:${user.id}`, RATE_LIMITS.like)) {
    return { error: "Too many Likes — please slow down and try again shortly." };
  }

  addLike({ rankingId, profileId, userId: user.id });
  revalidatePath(`/rankings/${rankingId}`);
  return {};
}
