"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { createProfile, findProfileById } from "@/db/profiles";
import { addNomineeToRanking } from "@/db/rankingProfiles";

export interface ActionResult {
  error?: string;
}

// Registered users may add a Nominee to a Ranking. If an existing Public
// Profile is selected (profileId present) it is reused; otherwise a brand
// new Public Profile is created automatically — a nominee never needs an
// account of their own.
export async function addNomineeAction(
  rankingId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "You must be logged in to add a Nominee." };
  }

  const existingProfileId = String(formData.get("profileId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const bio = String(formData.get("bio") || "").trim();

  let profileId = existingProfileId;

  if (existingProfileId) {
    const existing = findProfileById(existingProfileId);
    if (!existing) {
      return { error: "That profile no longer exists." };
    }
  } else {
    if (!name) {
      return { error: "Enter the nominee's name." };
    }
    const profile = createProfile({ name, bio });
    profileId = profile.id;
  }

  addNomineeToRanking({ rankingId, profileId, addedBy: user.id });
  revalidatePath(`/rankings/${rankingId}`);
  return {};
}
