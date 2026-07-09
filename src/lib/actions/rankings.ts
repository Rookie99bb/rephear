"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { createRanking } from "@/db/rankings";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit";

export interface ActionResult {
  error?: string;
}

export async function createRankingAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "You must be logged in to create a Ranking." };
  }

  if (!checkRateLimit(`createRanking:${user.id}`, RATE_LIMITS.createRanking)) {
    return {
      error: "You've created too many Rankings today. Please try again tomorrow.",
    };
  }

  const title = String(formData.get("title") || "").trim();
  const country = String(formData.get("country") || "").trim();
  const city = String(formData.get("city") || "").trim();
  const description = String(formData.get("description") || "").trim();

  if (!title || !country || !city) {
    return { error: "Title, country, and city are required." };
  }

  const ranking = createRanking({
    title,
    country,
    city,
    description,
    createdBy: user.id,
  });

  redirect(`/rankings/${ranking.id}`);
}
