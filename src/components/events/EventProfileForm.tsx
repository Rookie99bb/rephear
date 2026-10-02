"use client";

import { useFormState, useFormStatus } from "react-dom";
import PhotoPicker from "@/components/PhotoPicker";
import { EVENT_IDENTITIES } from "@/config/eventIdentities";
import { joinEventAction, nominateAtEventAction, type EventActionState } from "@/lib/actions/events";

const initial: EventActionState = {};

export default function EventProfileForm({ slug, mode }: { slug: string; mode: "self" | "nominate" }) {
  const action = mode === "self" ? joinEventAction.bind(null, slug) : nominateAtEventAction.bind(null, slug);
  const [state, formAction] = useFormState(action, initial);
  if (state.success) return <div className="rounded-3xl border border-violet-200 bg-violet-50 p-6"><p className="font-semibold text-violet-950">{state.success}</p><a className="mt-3 inline-block text-sm font-semibold text-violet-700 underline" href={`/events/${slug}${state.personId ? `/people/${state.personId}` : "#people"}`}>{mode === "self" ? "View my AnimeCon profile →" : "View profile →"}</a></div>;
  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-3xl border border-border bg-white p-5 shadow-sm sm:p-7">
      <div><h2 className="text-xl font-bold text-ink">{mode === "self" ? "I'm Here" : "Nominate Someone"}</h2><p className="mt-1 text-sm text-subtle">{mode === "self" ? "Make your event card in under 30 seconds." : "Help someone be discovered. Their card will be marked Community nominated."}</p></div>
      <label className="text-sm font-medium text-ink">Photo <span className="text-red-600">*</span><PhotoPicker /></label>
      <label className="text-sm font-medium text-ink">Display name <input name="displayName" required maxLength={80} className="mt-1 w-full rounded-xl border border-border px-3 py-2.5" /></label>
      <fieldset><legend className="mb-2 text-sm font-medium text-ink">I am / They are <span className="text-red-600">*</span></legend><div className="flex flex-wrap gap-2">{EVENT_IDENTITIES.map((identity) => <label key={identity} className="cursor-pointer rounded-full border border-border px-3 py-2 text-sm has-[:checked]:border-violet-500 has-[:checked]:bg-violet-50"><input className="sr-only" type="checkbox" name="identities" value={identity} />{identity}</label>)}</div></fieldset>
      <label className="text-sm font-medium text-ink">Say hi ♡ <textarea name="sayHi" maxLength={120} rows={3} placeholder="What are you excited to discover?" className="mt-1 w-full rounded-xl border border-border px-3 py-2.5" /></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-ink">Instagram (optional)<input name="instagramUrl" type="url" placeholder="https://instagram.com/..." className="mt-1 w-full rounded-xl border border-border px-3 py-2.5" /></label><label className="text-sm font-medium text-ink">TikTok (optional)<input name="tiktokUrl" type="url" placeholder="https://tiktok.com/@..." className="mt-1 w-full rounded-xl border border-border px-3 py-2.5" /></label></div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Submit label={mode === "self" ? "Join AnimeCon" : "Add community nomination"} />
    </form>
  );
}

function Submit({ label }: { label: string }) { const { pending } = useFormStatus(); return <button disabled={pending} className="rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Saving…" : label}</button>; }
