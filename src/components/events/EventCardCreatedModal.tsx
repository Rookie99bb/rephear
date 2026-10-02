"use client";

import Link from "next/link";
import { useState } from "react";
import EventShareTools from "@/components/events/EventShareTools";

export default function EventCardCreatedModal({ slug, personId }: { slug: string; personId: string }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  const cardPath = `/events/${slug}/people/${personId}`;
  return <div className="fixed inset-0 z-[100] flex items-end bg-black/50 p-0 sm:items-center sm:justify-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="event-card-created-title">
    <div className="relative w-full rounded-t-[30px] bg-white p-6 shadow-2xl sm:max-w-lg sm:rounded-[30px] sm:p-8">
      <button type="button" onClick={() => setOpen(false)} className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-slate-100 text-xl text-slate-600" aria-label="Close success message">×</button>
      <div aria-hidden className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-2xl text-white">✓</div>
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-violet-600">Card created successfully</p>
      <h2 id="event-card-created-title" className="mt-2 pr-8 text-3xl font-black tracking-tight text-ink">Your AnimeCon card is live ✦</h2>
      <p className="mt-3 text-base leading-7 text-subtle">People can now discover and recognise you. Start finding your people, or share your card with friends.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link href={`/events/${slug}#people`} className="rounded-xl bg-ink px-5 py-3.5 text-center text-sm font-bold text-white">Find my people →</Link>
        <Link href={cardPath} className="rounded-xl border border-violet-200 bg-violet-50 px-5 py-3.5 text-center text-sm font-bold text-violet-800">View my card</Link>
      </div>
      <div className="mt-1"><EventShareTools path={cardPath} name="My AnimeCon card" /></div>
    </div>
  </div>;
}
