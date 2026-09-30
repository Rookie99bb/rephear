"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useSupportCelebration } from "@/components/SupportCelebrationProvider";

// The primary action in the Support → Like → Share → More cluster:
// larger than its siblings, pink gradient, gentle floating + periodic
// pulse, glassmorphism ring, and a brief extra pulse + sparkle burst the
// instant this exact profile's Support is confirmed (via
// SupportCelebrationProvider's cardPulseProfileId) — the card-level half
// of the "connect the full-screen dialog back to the real card" effect.
// variant="icon" (default): the floating pink-gradient circle used on
// photo overlays (legacy placement).
// variant="card": the APPROVED mockup treatment — a vivid gold/yellow
// filled pill with 🪙, rendered BELOW the nominee image in the card's
// action area. Label follows the mockup: "🪙 Support" when credits = 0,
// "🪙 Support · 420 Credits" once activity exists. Never shows £/$ —
// Credits only, per product rules.
export default function SupportButton({
  rankingId,
  profileId,
  loggedIn,
  variant = "icon",
  credits = 0,
}: {
  rankingId: string;
  profileId: string;
  loggedIn: boolean;
  variant?: "icon" | "card";
  credits?: number;
}) {
  const { cardPulseProfileId } = useSupportCelebration();
  const prefersReducedMotion = useReducedMotion();
  const isPulsing = cardPulseProfileId === profileId;

  const href = loggedIn ? `/rankings/${rankingId}/support/${profileId}` : "/login";

  if (variant === "card") {
    return (
      <Link
        href={href}
        aria-label={
          credits > 0
            ? `Support this nominee (${credits.toLocaleString()} Credits so far)`
            : "Support this nominee"
        }
        onClick={(e) => e.stopPropagation()}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_6px_16px_-4px_rgba(180,83,9,0.6)] transition hover:shadow-[0_10px_22px_-4px_rgba(180,83,9,0.8)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 active:scale-95"
      >
        <span aria-hidden="true">🪙</span>
        {credits > 0 ? `Support · ${credits.toLocaleString()} Credits` : "Support"}
      </Link>
    );
  }

  return (
    <motion.div
      className="relative"
      animate={prefersReducedMotion ? {} : { y: [0, -2, 0] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
    >
      {isPulsing && !prefersReducedMotion && (
        <>
          <motion.span
            className="absolute inset-0 rounded-full bg-pink-400"
            initial={{ opacity: 0.6, scale: 1 }}
            animate={{ opacity: 0, scale: 1.9 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
          {["✨", "✨", "✨"].map((s, i) => (
            <motion.span
              key={i}
              className="pointer-events-none absolute text-xs"
              style={{ top: -4, left: 4 + i * 8 }}
              initial={{ opacity: 0, y: 0, scale: 0.6 }}
              animate={{ opacity: [0, 1, 0], y: -10, scale: 1 }}
              transition={{ duration: 0.9, delay: i * 0.08 }}
            >
              {s}
            </motion.span>
          ))}
        </>
      )}
      <motion.div
        animate={
          prefersReducedMotion
            ? {}
            : { scale: isPulsing ? [1, 1.25, 1] : [1, 1.06, 1] }
        }
        transition={
          isPulsing
            ? { duration: 0.6, ease: "easeOut" }
            : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }
        }
        whileHover={prefersReducedMotion ? {} : { scale: 1.12 }}
        whileTap={{ scale: 0.94 }}
        className="relative"
      >
        <Link
          href={href}
          title={loggedIn ? "Support" : "Log in to Support"}
          className="relative z-20 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 via-rose-500 to-pink-600 text-[17px] leading-none text-white shadow-[0_6px_18px_-4px_rgba(219,39,119,0.7)] ring-1 ring-white/40 backdrop-blur-md transition hover:shadow-[0_10px_24px_-4px_rgba(219,39,119,0.85)]"
        >
          💝
        </Link>
      </motion.div>
    </motion.div>
  );
}
