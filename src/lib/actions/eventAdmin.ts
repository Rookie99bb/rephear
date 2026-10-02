"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAdmin } from "@/lib/admin";
import { setEventPersonHidden } from "@/db/events";

export async function setEventPersonHiddenAction(personId: string, hidden: boolean): Promise<void> {
  if (!(await getCurrentAdmin())) throw new Error("Forbidden");
  await setEventPersonHidden(personId, hidden);
  revalidatePath("/admin/events");
  revalidatePath("/events/animecon-london-2026");
}
