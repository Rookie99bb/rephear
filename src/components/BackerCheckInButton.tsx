"use client";

import { useState, useTransition } from "react";
import { checkInAction } from "@/lib/actions/communityGrowth";

export default function BackerCheckInButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [streak, setStreak] = useState<number | null>(null);

  return (
    <div className="mt-auto pt-4">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => {
          const result = await checkInAction();
          setError(result.error ?? null);
          if (!result.error && result.currentStreak != null) setStreak(result.currentStreak);
        })}
        className="rounded-full bg-brand-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "One moment…" : "I’m Here ✦"}
      </button>
      {error && <p className="mt-2 text-xs text-red-600" role="status">{error}</p>}
      {streak != null && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-5" role="dialog" aria-modal="true" aria-labelledby="daily-presence-title">
          <div className="relative w-full max-w-md rounded-[28px] bg-white p-8 text-center shadow-2xl">
            <button type="button" onClick={() => setStreak(null)} className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-slate-100 text-lg text-slate-600" aria-label="Close">×</button>
            <div aria-hidden className="mx-auto grid size-14 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-2xl text-white">✦</div>
            <h2 id="daily-presence-title" className="mt-5 text-3xl font-black tracking-tight text-ink">Daily Presence</h2>
            <p className="mt-3 text-sm text-subtle">A small daily moment with your community.</p>
            <p className="mt-6 text-lg font-bold text-violet-700">I’m Here ✦</p>
            <p className="mt-3 leading-7 text-subtle">I have been part of the community for {streak} days in a row.</p>
          </div>
        </div>
      )}
    </div>
  );
}
