"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { setUserLocation } from "@/db/users";
import { isValidLocation } from "@/lib/locations";

export interface ActionResult {
  error?: string;
}

// Used both for the required first-time choice (LocationGate) and for
// changing it later from Settings.
export async function setLocationAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "You must be logged in to set a location." };
  }

  const location = String(formData.get("location") || "").trim();
  if (!isValidLocation(location)) {
    return { error: "Please choose a valid location." };
  }

  setUserLocation(user.id, location);
  revalidatePath("/");
  revalidatePath("/rankings");
  revalidatePath("/settings");
  return {};
}

// Plain (formData) => Promise<void> wrapper for binding directly to a
// native <form action={...}> without useFormState (used by LocationGate
// and Settings, which don't need per-field error state).
export async function submitLocationAction(formData: FormData): Promise<void> {
  await setLocationAction({}, formData);
}
