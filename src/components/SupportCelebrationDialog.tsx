"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion, animate } from "framer-motion";
import { useSupportCelebration } from "@/components/SupportCelebrationProvider";

const AUTO_CLOSE_MS = 5000;
const COUNTDOWN_RADIUS = 26;
const COUNTDOWN_CIRCUMFERENCE = 2 * Math.PI * COUNTDOWN_RADIUS;

// Full-screen "Thank You!" celebration, shown once a Support payment is
// confirmed (see CheckoutBanner, which polls /api/checkout/status and
// calls trigger()). Mounted once at the root via
// SupportCelebrationProvider — reads all its data from context, not
// props, so it can be triggered from anywhere.
export default function SupportCelebrationDialog() {
  const { celebration } = useSupportCelebration();
  return (
    <AnimatePresence>{celebration && <CelebrationContent />}</AnimatePresence>
  );
}

function CelebrationContent() {
  const { celebration, close } = useSupportCelebration();
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [displayCredits, setDisplayCredits] = useState(0);

  // Snapshotted ONCE via the lazy initializer, not read live from
  // `celebration` on every render. This matters because AnimatePresence
  // keeps this component mounted for its exit-fade animation *after*
  // close() has already set the context's celebration back to null --
  // without this snapshot, that re-render would hit `celebration!.
  // profileName` etc. on an actual null value and crash with "Cannot
  // read properties of null", surfacing to the user as Next's generic
  // "Application error: a client-side exception has occurred" page
  // right as (or just after) every celebration dialog closes.
  const [data] = useState(() => celebration!);

  // Focus trap + Escape-to-close + body scroll lock, mirroring
  // src/components/ui/Dialog.tsx's existing pattern.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    }
    document.addEventListener("keydown", handleKeyDown);

    const firstFocusable = containerRef.current?.querySelector<HTMLElement>(
      "button, [href], [tabindex]:not([tabindex='-1'])"
    );
    firstFocusable?.focus();

    if (!prefersReducedMotion && typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate([30, 40, 30]);
      } catch {
        // Some browsers/devices reject vibrate() outright — never let a
        // haptic nicety break the celebration itself.
      }
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [close, prefersReducedMotion]);

  // Auto-close after 5s, plus a once-a-second tick for the countdown label.
  useEffect(() => {
    const closeTimer = setTimeout(close, AUTO_CLOSE_MS);
    const tick = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => {
      clearTimeout(closeTimer);
      clearInterval(tick);
    };
  }, [close]);

  // Counts the Credits number up from 0 to the amount this payment
  // granted — always starts from 0 so it reads as "you just did this,"
  // not "here's your new total."
  useEffect(() => {
    const controls = animate(0, data.credits, {
      duration: prefersReducedMotion ? 0 : 1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate(v) {
        setDisplayCredits(Math.round(v));
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Soft two-tone chime, synthesized so no audio asset is needed.
  // Deliberately best-effort: a page-triggered (not click-triggered)
  // AudioContext is often blocked/suspended by browser autoplay policy,
  // and a muted/silent device should just stay silent either way. Any
  // failure here is swallowed.
  useEffect(() => {
    if (prefersReducedMotion) return;
    try {
      const AudioContextClass =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;
      [660, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const start = now + i * 0.12;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.05, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.4);
      });
      const closeTimer = setTimeout(() => {
        ctx.close().catch(() => {});
      }, 1000);
      return () => clearTimeout(closeTimer);
    } catch {
      // Autoplay policy blocked it, or no Web Audio support — fine.
    }
  }, [prefersReducedMotion]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <motion.div
        className="absolute inset-0 bg-black/60"
        style={{
          backdropFilter: "blur(10px) saturate(0.7)",
          WebkitBackdropFilter: "blur(10px) saturate(0.7)",
        }}
        onClick={close}
        aria-hidden="true"
      />

      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-celebration-title"
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-[28px] bg-gradient-to-b from-white to-pink-50 px-6 pb-7 pt-8 text-center shadow-[0_32px_80px_-16px_rgba(219,39,119,0.45)] sm:max-w-md"
        style={{ paddingBottom: "max(1.75rem, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-subtle transition hover:bg-black/5 hover:text-ink"
        >
          ✕
        </button>

        {!prefersReducedMotion && <FloatingHearts />}
        {!prefersReducedMotion && <Sparkles />}

        <motion.div
          initial={prefersReducedMotion ? false : { scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="relative"
        >
          <motion.div
            className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-rose-500 text-4xl shadow-[0_12px_28px_-6px_rgba(219,39,119,0.6)]"
            animate={prefersReducedMotion ? {} : { scale: [1, 1.08, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          >
            💗
          </motion.div>

          <h2
            id="support-celebration-title"
            className="text-2xl font-bold tracking-tight text-ink"
          >
            Thank You!
          </h2>
          <p className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-subtle">
            Thank you so much for supporting {data.profileName}. Your support
            is a powerful voice. Together we are building a community where
            every voice deserves to be heard.
          </p>

          <div className="mx-auto mt-5 inline-flex flex-col items-center gap-1 rounded-2xl bg-white/70 px-6 py-3 shadow-inner ring-1 ring-pink-200">
            <span className="text-xs font-semibold uppercase tracking-wide text-pink-600">
              Support Successful
            </span>
            <span className="text-3xl font-extrabold tabular-nums text-ink">
              +{displayCredits.toLocaleString()}{" "}
              <span className="text-lg font-semibold text-pink-600">Credits</span>
            </span>
          </div>

          <div className="mt-6 flex flex-col items-center gap-2">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r={COUNTDOWN_RADIUS}
                  fill="none"
                  stroke="#fbcfe8"
                  strokeWidth="4"
                />
                <motion.circle
                  cx="32"
                  cy="32"
                  r={COUNTDOWN_RADIUS}
                  fill="none"
                  stroke="#db2777"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={COUNTDOWN_CIRCUMFERENCE}
                  initial={{ strokeDashoffset: 0 }}
                  animate={{ strokeDashoffset: COUNTDOWN_CIRCUMFERENCE }}
                  transition={{ duration: AUTO_CLOSE_MS / 1000, ease: "linear" }}
                />
              </svg>
              <span className="text-lg font-bold text-ink">{secondsLeft}</span>
            </div>
            <p className="text-xs text-subtle">This window will close automatically</p>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href={`/profiles/${data.profileId}`}
              onClick={close}
              className="flex-1 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 sm:flex-none"
            >
              View Profile
            </Link>
            <button
              type="button"
              onClick={close}
              className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold text-ink transition hover:bg-surface sm:flex-none"
            >
              Continue
            </button>
          </div>
        </motion.div>
      </div>
    </motion.div>,
    document.body
  );
}

function FloatingHearts() {
  const hearts = ["💕", "💗", "💖", "💓", "💘"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 7 }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute bottom-0 text-lg"
          style={{ left: `${8 + i * 12}%` }}
          initial={{ y: 40, opacity: 0 }}
          animate={{
            y: -220,
            opacity: [0, 1, 1, 0],
            x: [0, i % 2 === 0 ? 10 : -10, 0],
          }}
          transition={{
            duration: 3 + (i % 3),
            repeat: Infinity,
            delay: i * 0.4,
            ease: "easeOut",
          }}
        >
          {hearts[i % hearts.length]}
        </motion.span>
      ))}
    </div>
  );
}

function Sparkles() {
  const positions = [
    { top: "12%", left: "14%" },
    { top: "20%", left: "82%" },
    { top: "40%", left: "6%" },
    { top: "55%", left: "90%" },
    { top: "75%", left: "16%" },
    { top: "68%", left: "80%" },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {positions.map((pos, i) => (
        <motion.span
          key={i}
          className="absolute text-sm text-pink-300"
          style={pos}
          animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.3, ease: "easeInOut" }}
        >
          ✨
        </motion.span>
      ))}
    </div>
  );
}
