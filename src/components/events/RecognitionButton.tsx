"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { recognizeAtEventAction, type EventActionState } from "@/lib/actions/events";

export default function RecognitionButton({ slug, personId, personName, initialRecognized, mutual = false, source = "direct" }: { slug: string; personId: string; personName: string; initialRecognized: boolean; mutual?: boolean; source?: "direct" | "discovery" }) {
  const router = useRouter();
  const [recognized, setRecognized] = useState(initialRecognized);
  const [result, setResult] = useState<EventActionState | null>(null);
  const [pending, startTransition] = useTransition();
  function recognize() {
    if (recognized || pending) return;
    setRecognized(true);
    startTransition(async () => {
      const next = await recognizeAtEventAction(slug, personId, source);
      if (next.error) setRecognized(false);
      setResult(next);
      router.refresh();
    });
  }
  return <>
    <button type="button" onClick={recognize} disabled={recognized || pending} className="min-h-11 w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:bg-violet-100 disabled:text-violet-800">{pending ? "Recognizing…" : mutual ? "✦ Mutual" : recognized ? "✓ Recognized" : "◎ Recognize"}</button>
    {result && <div className="fixed inset-0 z-50 flex items-end bg-black/35 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-label="Recognition sent"><div className="w-full rounded-t-[28px] bg-white p-6 shadow-2xl sm:max-w-md sm:rounded-[28px]"><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Public recognition</p><h2 className="mt-2 text-2xl font-black text-ink">{result.error ?? result.success}</h2>{!result.error && <><p className="mt-2 text-sm text-subtle">{personName} can now see your recognition. Recognition is public in this event.</p>{result.mutual && <p className="mt-3 rounded-xl bg-violet-50 p-3 text-sm font-semibold text-violet-800">✦ Mutual Recognition — you recognize each other.</p>}<div className="mt-5 flex flex-col gap-2"><Link href={result.discoveryHref ?? `/events/${slug}/people/${personId}/recognized`} className="rounded-xl bg-violet-700 px-5 py-3 text-center text-sm font-bold text-white">See who {personName} recognizes →</Link><button type="button" onClick={() => setResult(null)} className="rounded-xl border border-border px-5 py-3 text-sm font-bold text-ink">Continue discovering</button></div></>} {result.error && <button type="button" onClick={() => setResult(null)} className="mt-5 w-full rounded-xl bg-ink px-5 py-3 text-sm font-bold text-white">Close</button>}</div></div>}
  </>;
}
