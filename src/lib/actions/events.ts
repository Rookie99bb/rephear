"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { findEventPerson, findEventPersonByUser, findSocialEvent, nominateEventPerson, recognizePerson, recordEventAnalytics, upsertSelfAtEvent } from "@/db/events";
import { EVENT_IDENTITIES, type EventIdentity } from "@/config/eventIdentities";
import { normalizeSocialProfileUrl } from "@/lib/socialProfileUrl";
import { createNotification } from "@/db/notifications";

export type EventActionState = { error?: string; success?: string; personId?: string; personName?: string; mutual?: boolean; discoveryHref?: string };

function fields(formData: FormData) {
  const displayName = String(formData.get("displayName") ?? "").trim().slice(0, 80);
  const photoUrl = String(formData.get("photoUrl") ?? "").trim();
  const sayHi = String(formData.get("sayHi") ?? "").trim().slice(0, 120);
  const fandomTags = String(formData.get("fandomTags") ?? "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 8).map((x) => x.slice(0, 30));
  const identities = formData.getAll("identities").map(String).filter((x): x is EventIdentity => EVENT_IDENTITIES.includes(x as EventIdentity));
  return { displayName, photoUrl, sayHi, identities, fandomTags, instagramUrl: normalizeSocialProfileUrl(formData.get("instagramUrl"), "instagram"), tiktokUrl: normalizeSocialProfileUrl(formData.get("tiktokUrl"), "tiktok") };
}

async function context(slug: string) {
  const [user, event] = await Promise.all([getCurrentUser(), findSocialEvent(slug)]);
  if (!event) return { error: "Event not found." } as const;
  if (!user) return { error: "Please log in to continue." } as const;
  return { user, event } as const;
}

export async function joinEventAction(slug: string, _prev: EventActionState, formData: FormData): Promise<EventActionState> {
  const ctx = await context(slug); if ("error" in ctx) return ctx;
  const value = fields(formData);
  if (!value.displayName || !value.photoUrl || value.identities.length === 0) return { error: "Add a photo, display name, and at least one identity." };
  if (!checkRateLimit(`eventJoin:${ctx.user.id}`, RATE_LIMITS.nominate)) return { error: "Please slow down and try again shortly." };
  const personId = await upsertSelfAtEvent({ eventId: ctx.event.id, userId: ctx.user.id, ...value });
  await recordEventAnalytics({ eventId: ctx.event.id, eventName: "join_completed", userId: ctx.user.id });
  revalidatePath(`/events/${slug}`); revalidatePath(`/events/${slug}/people/${personId}`);
  return { success: "You're here ✦ Now discover your people.", personId };
}

export async function nominateAtEventAction(slug: string, _prev: EventActionState, formData: FormData): Promise<EventActionState> {
  const ctx = await context(slug); if ("error" in ctx) return ctx;
  const value = fields(formData);
  if (!value.displayName || !value.photoUrl || value.identities.length === 0) return { error: "Add their photo, name, and at least one identity." };
  if (!checkRateLimit(`eventNominate:${ctx.user.id}`, RATE_LIMITS.nominate)) return { error: "Please slow down and try again shortly." };
  const personId = await nominateEventPerson({ eventId: ctx.event.id, nominatorId: ctx.user.id, ...value });
  await recordEventAnalytics({ eventId: ctx.event.id, eventName: "nomination_completed", userId: ctx.user.id });
  revalidatePath(`/events/${slug}`);
  return { success: "Community nomination added.", personId };
}

export async function recognizeAtEventAction(slug: string, personId: string, source = "direct"): Promise<EventActionState> {
  const ctx = await context(slug); if ("error" in ctx) return ctx;
  if (!checkRateLimit(`eventRecognize:${ctx.user.id}`, RATE_LIMITS.like)) return { error: "Please slow down and try again shortly." };
  const target = await findEventPerson(personId, ctx.user.id);
  if (!target || target.eventId !== ctx.event.id) return { error: "Person not found." };
  const result = await recognizePerson(ctx.event.id, ctx.user.id, personId);
  if (result === "self") return { error: "You can't recognise yourself." };
  revalidatePath(`/events/${slug}`); revalidatePath(`/events/${slug}/people/${personId}`);
  if (result === "created" || result === "mutual") {
    await recordEventAnalytics({ eventId: ctx.event.id, eventName: source === "discovery" ? "recognition_discovery_recognized" : result === "mutual" ? "recognition_mutual_created" : "recognition_created", userId: ctx.user.id, metadata: { personId, source } });
    if (target.userId) {
      const recognizer = await findEventPersonByUser(ctx.event.id, ctx.user.id, ctx.user.id);
      await createNotification({ userId: target.userId, type: "event_recognition", title: "Someone recognized you ✦", body: `${ctx.event.title} · View their event profile.`, link: recognizer ? `/events/${slug}/people/${recognizer.id}` : `/events/${slug}` });
    }
  }
  return { success: result === "exists" ? "Already recognised." : result === "mutual" ? `You and ${target.displayName} recognize each other ✦` : `You recognized ${target.displayName} ✦`, personId, personName: target.displayName, mutual: result === "mutual", discoveryHref: `/events/${slug}/people/${personId}/recognized` };
}

export async function recognizeAtEventFormAction(slug: string, personId: string): Promise<void> {
  await recognizeAtEventAction(slug, personId);
}
