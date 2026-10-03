"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { findSocialEvent } from "@/db/events";
import { findEventPersonByUser } from "@/db/events";
import { sendEventMessage } from "@/db/eventMessages";
import { findUserById } from "@/db/users";
import { sendEmail } from "@/lib/email";
import { eventMessageEmail } from "@/emails/eventMessage";

export async function sendEventMessageAction(slug: string, conversationId: string, formData: FormData) {
  const [user, event] = await Promise.all([getCurrentUser(), findSocialEvent(slug)]);
  if (!user || !event) return;
  const sent = await sendEventMessage(conversationId, event.id, user.id, String(formData.get("body") ?? ""));
  revalidatePath(`/events/${slug}/messages/${conversationId}`);
  try {
    const [recipient, senderCard, recipientCard] = await Promise.all([
      findUserById(sent.recipientUserId),
      findEventPersonByUser(event.id, user.id, sent.recipientUserId),
      findEventPersonByUser(event.id, sent.recipientUserId, user.id),
    ]);
    if (!recipient?.email) return;
    const recipientInterests = new Set((recipientCard?.fandomTags ?? []).map((tag) => tag.toLocaleLowerCase()));
    const commonInterests = (senderCard?.fandomTags ?? []).filter((tag) => recipientInterests.has(tag.toLocaleLowerCase()));
    const message = eventMessageEmail({
      eventTitle: event.title,
      slug,
      conversationId,
      recipientName: recipientCard?.displayName || recipient.name || "there",
      senderName: senderCard?.displayName || user.name || "Someone",
      senderPhotoUrl: senderCard?.photoUrl || "",
      senderIdentities: senderCard?.identities ?? [],
      commonInterests,
    });
    await sendEmail({ to: recipient.email, ...message });
  } catch (error) {
    console.error("[event-message-email]", error);
  }
}
