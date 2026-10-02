"use client";

import { useFormState, useFormStatus } from "react-dom";
import PhotoPicker from "@/components/PhotoPicker";
import { EVENT_IDENTITIES } from "@/config/eventIdentities";
import { joinEventAction, nominateAtEventAction, type EventActionState } from "@/lib/actions/events";
import EventShareTools from "@/components/events/EventShareTools";

const initial: EventActionState = {};

export default function EventProfileForm({ slug, mode }: { slug: string; mode: "self" | "nominate" }) {
  const action = mode === "self" ? joinEventAction.bind(null, slug) : nominateAtEventAction.bind(null, slug);
  const [state, formAction] = useFormState(action, initial);
  if (state.success) {
    const path = `/events/${slug}${state.personId ? `/people/${state.personId}` : "#people"}`;
    return <div className="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-7"><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">You’re on the AnimeCon map ✦</p><h2 className="mt-2 text-2xl font-black text-violet-950">{state.success}</h2><p className="mt-2 text-sm text-violet-800">Share your card so friends and people you meet can find you again after the event.</p><EventShareTools path={path} name="My AnimeCon card" /><a className="mt-5 inline-block text-sm font-semibold text-violet-700 underline" href={path}>{mode === "self" ? "View my AnimeCon profile →" : "View profile →"}</a></div>;
  }
  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-3xl border border-border bg-white p-5 shadow-sm sm:p-7">
      <div><h2 className="text-xl font-bold text-ink">{mode === "self" ? "I'm Here" : "Nominate Someone"}</h2><p className="mt-1 text-sm text-subtle">{mode === "self" ? "Make your event card in under 30 seconds." : "Help someone be discovered. Their card will be marked Community nominated."}</p></div>
      <label className="text-sm font-medium text-ink">Photo <span className="text-red-600">*</span><PhotoPicker /></label>
      <label className="text-sm font-medium text-ink">Display name <input name="displayName" required maxLength={80} className="mt-1 w-full rounded-xl border border-border px-3 py-2.5" /></label>
      <fieldset><legend className="mb-2 text-sm font-medium text-ink">I am / They are <span className="text-red-600">*</span></legend><div className="flex flex-wrap gap-2">{EVENT_IDENTITIES.map((identity) => <label key={identity} className="cursor-pointer rounded-full border border-border px-3 py-2 text-sm has-[:checked]:border-violet-500 has-[:checked]:bg-violet-50"><input className="sr-only" type="checkbox" name="identities" value={identity} />{identity}</label>)}</div></fieldset>
      <label className="text-sm font-medium text-ink">Say hi ♡ <textarea name="sayHi" maxLength={120} rows={3} placeholder="What are you excited to discover?" className="mt-1 w-full rounded-xl border border-border px-3 py-2.5" /></label>
      <div><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-ink">Instagram username <span className="font-normal text-subtle">(optional)</span><input name="instagramUrl" inputMode="text" autoCapitalize="none" placeholder="@yourname" className="mt-1 w-full rounded-xl border border-border px-3 py-2.5" /></label><label className="text-sm font-medium text-ink">TikTok username <span className="font-normal text-subtle">(optional)</span><input name="tiktokUrl" inputMode="text" autoCapitalize="none" placeholder="@yourname" className="mt-1 w-full rounded-xl border border-border px-3 py-2.5" /></label></div><p className="mt-2 text-xs text-subtle">Let people you meet find you after AnimeCon. These links will be public and can be removed later.</p></div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Submit label={mode === "self" ? "Join AnimeCon" : "Add community nomination"} />
    </form>
  );
}

function Submit({ label }: { label: string }) { const { pending } = useFormStatus(); return <button disabled={pending} className="rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Saving…" : label}</button>; }
