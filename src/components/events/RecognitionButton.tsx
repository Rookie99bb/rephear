"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { recognizeAtEventAction, type EventActionState } from "@/lib/actions/events";

const RECOGNITION_TIMEOUT_MS = 12_000;
const POPOVER_MARGIN = 16;

type PopoverPosition = {
  left: number;
  top: number;
  width: number;
  placement: "above" | "below";
};

export default function RecognitionButton({ slug, personId, personName, initialRecognized, mutual = false, source = "direct", recogniseBack = false }: { slug: string; personId: string; personName: string; initialRecognized: boolean; mutual?: boolean; source?: "direct" | "discovery"; recogniseBack?: boolean }) {
  const router = useRouter();
  const [recognized, setRecognized] = useState(initialRecognized);
  const [result, setResult] = useState<EventActionState | null>(null);
  const [pending, setPending] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const positionPopover = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;

    const anchor = button.closest("article")?.getBoundingClientRect() ?? button.getBoundingClientRect();
    const width = Math.min(448, window.innerWidth - POPOVER_MARGIN * 2);
    const measuredHeight = dialogRef.current?.offsetHeight ?? 300;
    const left = Math.min(
      Math.max(anchor.left + anchor.width / 2 - width / 2, POPOVER_MARGIN),
      window.innerWidth - width - POPOVER_MARGIN,
    );
    const roomAbove = anchor.top - POPOVER_MARGIN;
    const roomBelow = window.innerHeight - anchor.bottom - POPOVER_MARGIN;
    const placement = roomBelow >= measuredHeight || roomBelow >= roomAbove ? "below" : "above";
    const preferredTop = placement === "below"
      ? anchor.bottom + 12
      : anchor.top - measuredHeight - 12;
    const top = Math.min(
      Math.max(preferredTop, POPOVER_MARGIN),
      Math.max(POPOVER_MARGIN, window.innerHeight - measuredHeight - POPOVER_MARGIN),
    );

    setPopoverPosition({ left, top, width, placement });
  }, []);

  useEffect(() => {
    if (initialRecognized) setRecognized(true);
  }, [initialRecognized]);

  useLayoutEffect(() => {
    if (!result) return;
    positionPopover();
  }, [result, positionPopover]);

  useEffect(() => {
    if (!result) return;
    const update = () => positionPopover();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [result, positionPopover]);

  async function recognize() {
    if (recognized || pending) return;
    setRecognized(true);
    setPending(true);

    const safeAction = recognizeAtEventAction(slug, personId, source).catch((error) => {
      console.error("[event-recognition-client]", error);
      return { error: "We couldn't save this recognition. Please try again." } satisfies EventActionState;
    });
    const timeout = new Promise<EventActionState>((resolve) => {
      window.setTimeout(() => resolve({ error: "This is taking longer than expected. Please try again." }), RECOGNITION_TIMEOUT_MS);
    });

    try {
      const next = await Promise.race([safeAction, timeout]);
      if (next.error) setRecognized(false);
      positionPopover();
      setResult(next);
      if (!next.error) router.refresh();
    } finally {
      setPending(false);
    }
  }
  return <>
    <button ref={buttonRef} type="button" onClick={recognize} disabled={recognized || pending} className="min-h-11 w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:bg-violet-100 disabled:text-violet-800">{pending ? "Recognising…" : mutual ? "✦ Mutual" : recognized ? "✓ Recognised" : recogniseBack ? "◎ Recognise back" : "◎ Recognise"}</button>
    {result && popoverPosition && typeof document !== "undefined" && createPortal(<div className="fixed inset-0 z-50 bg-black/25" role="dialog" aria-modal="true" aria-label="Recognition sent"><div ref={dialogRef} className="fixed max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl ring-1 ring-black/5" style={{ left: popoverPosition.left, top: popoverPosition.top, width: popoverPosition.width }}><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Public recognition</p><h2 className="mt-2 text-2xl font-black text-ink">{result.error ?? (result.mutual ? "You’ve made a mutual connection!" : result.success)}</h2>{!result.error && <><p className="mt-2 text-sm text-subtle">{personName} can now see your recognition. Recognition is public in this event.</p>{result.mutual && <p className="mt-3 rounded-xl bg-violet-50 p-3 text-sm font-semibold text-violet-800">✦ Mutual — you recognise each other.</p>}<div className="mt-5 flex flex-col gap-2"><Link href={result.discoveryHref ?? `/events/${slug}/people/${personId}/recognized`} className="rounded-xl bg-violet-700 px-5 py-3 text-center text-sm font-bold text-white">See who {personName} recognises →</Link><button type="button" onClick={() => setResult(null)} className="rounded-xl border border-border px-5 py-3 text-sm font-bold text-ink">Continue discovering</button></div></>} {result.error && <button type="button" onClick={() => setResult(null)} className="mt-5 w-full rounded-xl bg-ink px-5 py-3 text-sm font-bold text-white">Close</button>}</div></div>, document.body)}
  </>;
}
