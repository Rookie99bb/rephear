"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { createProfile, findNomineeByRankingAndName } from "@/db/profiles";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit";

export interface ActionResult {
  error?: string;
}

// Registered users may nominate someone in a Ranking. There is no shared
// profile system — this always creates a brand new Nominee that exists
// only inside this Ranking. The same name can appear in other Rankings
// (those are separate Nominees), but not twice in this same one.
export async function addNomineeAction(
  rankingId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "You must be logged in to add a Nominee." };
  }

  const name = String(formData.get("name") || "").trim();
  const bio = String(formData.get("bio") || "").trim();
  const photoUrl = String(formData.get("photoUrl") || "").trim();

  if (!name) {
    return { error: "Enter the nominee's name." };
  }

  if (findNomineeByRankingAndName(rankingId, name)) {
    return { error: "This person has already been nominated in this ranking." };
  }

  if (!checkRateLimit(`nominee:${user.id}`, RATE_LIMITS.nominate)) {
    return { error: "Too many nominations — please slow down and try again shortly." };
  }

  createProfile({ rankingId, name, bio, photoUrl, addedBy: user.id });
  revalidatePath(`/rankings/${rankingId}`);
  return {};
}
