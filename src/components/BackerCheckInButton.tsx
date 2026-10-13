"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkInAction } from "@/lib/actions/communityGrowth";

export default function BackerCheckInButton({
  variant = "card",
}: {
  variant?: "card" | "navigation";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [streak, setStreak] = useState<number | null>(null);

  useEffect(() => {
    if (streak == null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setStreak(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [streak]);

  const isNavigation = variant === "navigation";

  return (
    <div className={isNavigation ? "relative inline-flex" : "mt-auto pt-4"}>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => {
          const result = await checkInAction();
          setError(result.error ?? null);
          if (!result.error && result.currentStreak != null) {
            setStreak(result.currentStreak);
            router.refresh();
          }
        })}
        className={isNavigation
          ? "rounded-full bg-violet-50 px-3.5 py-1.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:opacity-60"
          : "rounded-full bg-brand-ink px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:opacity-60"}
      >
        {pending ? "One moment…" : "I’m Here ✦"}
      </button>
      {error && (
        <p
          className={isNavigation
            ? "absolute left-1/2 top-full z-50 mt-2 w-56 -translate-x-1/2 rounded-xl border border-red-100 bg-white p-3 text-center text-xs text-red-600 shadow-lg"
            : "mt-2 text-xs text-red-600"}
          role="status"
        >
          {error}
        </p>
      )}
      {streak != null && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-5 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="daily-presence-title"
          aria-describedby="daily-presence-description daily-presence-streak"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setStreak(null);
          }}
        >
          <div className="relative w-full max-w-md overflow-hidden rounded-[30px] border border-white/70 bg-white px-7 py-9 text-center shadow-[0_30px_90px_rgba(46,16,101,0.28)] sm:px-10 sm:py-11">
            <div aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-rose-400" />
            <button type="button" onClick={() => setStreak(null)} className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-slate-100 text-lg text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2" aria-label="Close Daily Presence">×</button>
            <div aria-hidden className="mx-auto grid size-16 place-items-center rounded-full bg-gradient-to-br from-violet-600 via-fuchsia-500 to-rose-400 text-2xl text-white shadow-lg shadow-fuchsia-200">✦</div>
            <h2 id="daily-presence-title" className="mt-6 text-3xl font-black tracking-tight text-ink">Daily Presence</h2>
            <p id="daily-presence-description" className="mt-3 text-sm leading-6 text-subtle">A small daily moment with your community.</p>
            <p className="mt-7 text-lg font-bold text-violet-700">I’m Here ✦</p>
            <p id="daily-presence-streak" className="mt-3 leading-7 text-subtle">I have been part of the community for {streak} days in a row.</p>
          </div>
        </div>
      )}
    </div>
  );
}
