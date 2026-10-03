"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { findSocialEvent } from "@/db/events";
import { sendEventMessage } from "@/db/eventMessages";

export async function sendEventMessageAction(slug: string, conversationId: string, formData: FormData) {
  const [user, event] = await Promise.all([getCurrentUser(), findSocialEvent(slug)]);
  if (!user || !event) return;
  await sendEventMessage(conversationId, event.id, user.id, String(formData.get("body") ?? ""));
  revalidatePath(`/events/${slug}/messages/${conversationId}`);
}
