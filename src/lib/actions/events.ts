"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { findEventPerson, findSocialEvent, nominateEventPerson, recognizePerson, recordEventAnalytics, upsertSelfAtEvent } from "@/db/events";
import { EVENT_IDENTITIES, type EventIdentity } from "@/config/eventIdentities";
import { normalizeSocialProfileUrl } from "@/lib/socialProfileUrl";
import { createNotification } from "@/db/notifications";

export type EventActionState = { error?: string; success?: string; personId?: string; personName?: string; mutual?: boolean; discoveryHref?: string };

const OPTIONAL_EVENT_WORK_TIMEOUT_MS = 1_500;

async function settleOptionalEventWork(label: string, work: Promise<unknown>[]): Promise<void> {
  const settled = Promise.allSettled(work).then((results) => {
    for (const result of results) {
      if (result.status === "rejected") console.error(`[${label}]`, result.reason);
    }
  });
  await Promise.race([
    settled,
    new Promise<void>((resolve) => setTimeout(resolve, OPTIONAL_EVENT_WORK_TIMEOUT_MS)),
  ]);
}

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
  if (!value.photoUrl) return { error: "Please add a photo." };
  if (!value.displayName) return { error: "Please add a display name." };
  if (value.identities.length === 0) return { error: "Please choose at least one identity." };
  if (!checkRateLimit(`eventJoin:${ctx.user.id}`, RATE_LIMITS.nominate)) return { error: "Please slow down and try again shortly." };
  let personId: string;
  try {
    personId = await upsertSelfAtEvent({ eventId: ctx.event.id, userId: ctx.user.id, ...value });
    await recordEventAnalytics({ eventId: ctx.event.id, eventName: "join_completed", userId: ctx.user.id }).catch((error) => console.error("[event-join-analytics]", error));
  } catch (error) {
    console.error("[event-join-save]", error);
    return { error: "We couldn't save your event card. Your entries are still here — please try again." };
  }
  revalidatePath(`/events/${slug}`); revalidatePath(`/events/${slug}/people/${personId}`);
  redirect(`/events/${slug}?created=${encodeURIComponent(personId)}`);
}

export async function nominateAtEventAction(slug: string, _prev: EventActionState, formData: FormData): Promise<EventActionState> {
  const ctx = await context(slug); if ("error" in ctx) return ctx;
  const value = fields(formData);
  if (!value.photoUrl) return { error: "Please add their photo." };
  if (!value.displayName) return { error: "Please add their name." };
  if (value.identities.length === 0) return { error: "Please choose at least one identity." };
  if (!checkRateLimit(`eventNominate:${ctx.user.id}`, RATE_LIMITS.nominate)) return { error: "Please slow down and try again shortly." };
  try {
    const personId = await nominateEventPerson({ eventId: ctx.event.id, nominatorId: ctx.user.id, ...value });
    await recordEventAnalytics({ eventId: ctx.event.id, eventName: "nomination_completed", userId: ctx.user.id }).catch((error) => console.error("[event-nomination-analytics]", error));
    revalidatePath(`/events/${slug}`);
    return { success: "Community nomination added.", personId };
  } catch (error) {
    console.error("[event-nomination-save]", error);
    return { error: "We couldn't save this nomination. Your entries are still here — please try again." };
  }
}

export async function recognizeAtEventAction(slug: string, personId: string, source = "direct"): Promise<EventActionState> {
  try {
    const ctx = await context(slug); if ("error" in ctx) return ctx;
    if (!checkRateLimit(`eventRecognize:${ctx.user.id}`, RATE_LIMITS.like)) return { error: "Please slow down and try again shortly." };
    const target = await findEventPerson(personId, ctx.user.id);
    if (!target || target.eventId !== ctx.event.id) return { error: "Person not found." };
    const result = await recognizePerson(ctx.event.id, ctx.user.id, personId);
    if (result === "self") return { error: "You can't recognise yourself." };
    revalidatePath(`/events/${slug}`); revalidatePath(`/events/${slug}/people/${personId}`);
    if (result === "created" || result === "mutual") {
      const optionalWork: Promise<unknown>[] = [
        recordEventAnalytics({ eventId: ctx.event.id, eventName: source === "discovery" ? "recognition_discovery_recognized" : result === "mutual" ? "recognition_mutual_created" : "recognition_created", userId: ctx.user.id, metadata: { personId, source } }),
      ];
      if (target.userId) {
        optionalWork.push(createNotification({ userId: target.userId, type: "event_recognition", title: "Someone recognized you ✦", body: `${ctx.event.title} · View their event profile.`, link: `/events/${slug}` }));
      }
      await settleOptionalEventWork("event-recognition-optional-work", optionalWork);
    }
    return { success: result === "exists" ? "Already recognised." : result === "mutual" ? `You and ${target.displayName} recognize each other ✦` : `You recognized ${target.displayName} ✦`, personId, personName: target.displayName, mutual: result === "mutual", discoveryHref: `/events/${slug}/people/${personId}/recognized` };
  } catch (error) {
    console.error("[event-recognition-save]", error);
    return { error: "We couldn't save this recognition. Please try again." };
  }
}

export async function recognizeAtEventFormAction(slug: string, personId: string): Promise<void> {
  await recognizeAtEventAction(slug, personId);
}
