"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useSupportCelebration } from "@/components/SupportCelebrationProvider";

// Absolutely-positioned overlay sibling rendered inside NomineeCard (a
// Server Component) so the card itself never needs a "use client"
// directive. Lights up with a pink ring + soft glow for ~1s the instant
// this exact profile's Support is confirmed — the card-level half of
// connecting the full-screen celebration dialog back to the real card
// behind it.
export default function NomineeCardGlow({ profileId }: { profileId: string }) {
  const { cardPulseProfileId } = useSupportCelebration();
  const prefersReducedMotion = useReducedMotion();
  const active = cardPulseProfileId === profileId;

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[16] rounded-3xl"
      initial={false}
      animate={
        active
          ? {
              opacity: 1,
              boxShadow:
                "inset 0 0 0 3px rgba(244,114,182,0.9), 0 0 60px 10px rgba(244,114,182,0.55)",
            }
          : {
              opacity: 0,
              boxShadow: "inset 0 0 0 0px rgba(244,114,182,0), 0 0 0px 0px rgba(244,114,182,0)",
            }
      }
      transition={{ duration: prefersReducedMotion ? 0.01 : 0.5, ease: "easeOut" }}
    />
  );
}
