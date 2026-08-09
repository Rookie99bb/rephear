"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useSupportCelebration } from "@/components/SupportCelebrationProvider";

// Support payment happens via an off-site Stripe Checkout redirect, so
// there is no single instant in-page moment to hang the celebration off
// of — Stripe sends the browser back here with ?support=success&
// session_id=..., but Credits are only actually granted once the Stripe
// webhook processes checkout.session.completed (async, arrives
// independently of the browser redirect). So this polls
// /api/checkout/status until that's confirmed, then fires the full-screen
// celebration (SupportCelebrationProvider) and cleans the URL. A short
// "Confirming your payment…" banner covers the (usually sub-second, but
// not guaranteed) gap.
const POLL_INTERVAL_MS = 1200;
const MAX_POLL_ATTEMPTS = 15; // ~18s ceiling

export default function CheckoutBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { trigger } = useSupportCelebration();
  const [dismissed, setDismissed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const handledRef = useRef(false);

  const support = searchParams.get("support");
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    if (support === "cancelled" && sessionId) {
      fetch("/api/checkout/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
    }
  }, [support, sessionId]);

  useEffect(() => {
    if (support !== "success" || !sessionId || handledRef.current) return;
    handledRef.current = true;
    setConfirming(true);

    let cancelled = false;

    async function poll() {
      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS && !cancelled; attempt++) {
        try {
          const res = await fetch(
            `/api/checkout/status?session_id=${encodeURIComponent(sessionId!)}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data.status === "completed") {
              trigger({
                profileId: data.profileId,
                profileName: data.profileName,
                rankingId: data.rankingId,
                credits: data.credits,
                totalCredits: data.totalCredits,
              });
              setConfirming(false);
              router.replace(pathname);
              return;
            }
            if (["failed", "cancelled", "refunded", "disputed"].includes(data.status)) {
              setConfirming(false);
              setFailed(true);
              return;
            }
          }
        } catch {
          // transient network hiccup — keep polling until MAX_POLL_ATTEMPTS
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
      if (!cancelled) {
        setConfirming(false);
        setFailed(true); // fall back to the plain banner rather than spinning forever
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [support, sessionId, trigger, router, pathname]);

  if (!support || dismissed) return null;

  function close() {
    setDismissed(true);
    router.replace(pathname);
  }

  if (support === "success") {
    if (confirming) {
      return (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-pink-200 bg-pink-50 px-4 py-3 text-sm text-pink-800">
          <span className="h-2 w-2 animate-pulse rounded-full bg-pink-500" />
          <span>Confirming your payment…</span>
        </div>
      );
    }
    if (failed) {
      return (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>
            Thank you for your support! Your Reputation Credits will appear
            shortly once payment is confirmed.
          </span>
          <button onClick={close} className="text-emerald-700 underline">
            Dismiss
          </button>
        </div>
      );
    }
    // Confirmed — the celebration dialog is showing instead of a banner.
    return null;
  }

  if (support === "cancelled") {
    return (
      <div className="mb-6 flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm text-subtle">
        <span>Checkout was cancelled. No payment was made.</span>
        <button onClick={close} className="text-ink underline">
          Dismiss
        </button>
      </div>
    );
  }

  return null;
}
