"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { createRanking } from "@/db/rankings";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { isValidLocation, getCountryForCity } from "@/lib/locations";

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
  const city = String(formData.get("city") || "").trim();
  const description = String(formData.get("description") || "").trim();

  if (!title || !city) {
    return { error: "Title and city are required." };
  }

  // Country is never free-typed — it's always derived from the chosen
  // city, using the same fixed list as user location selection. This is
  // what makes country-based flag filtering reliable (no more "GB" vs
  // "United Kingdom" mismatches from manual entry).
  if (!isValidLocation(city)) {
    return { error: "Please choose a city from the list." };
  }
  const country = getCountryForCity(city)!;

  const ranking = await createRanking({
    title,
    country,
    city,
    description,
    createdBy: user.id,
  });

  redirect(`/rankings/${ranking.id}`);
}
