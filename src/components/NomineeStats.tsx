"use client";

import { useEffect, useRef, useState } from "react";
import { motion, animate } from "framer-motion";
import { useSupportCelebration } from "@/components/SupportCelebrationProvider";

// Redesigned Likes/Credits stat row: larger type, brighter emphasis
// color, icon+number grouped, a vertical separator between the two, and
// a smooth count-up + glow on Credits the instant this exact profile's
// Support is confirmed elsewhere on the page.
export default function NomineeStats({
  profileId,
  likeCount,
  credits,
  emphasis,
}: {
  profileId: string;
  likeCount: number;
  credits: number;
  emphasis: "likes" | "credits";
}) {
  const { celebration } = useSupportCelebration();
  const [displayCredits, setDisplayCredits] = useState(credits);
  const creditsRef = useRef(credits);
  const [glow, setGlow] = useState(false);

  useEffect(() => {
    creditsRef.current = credits;
    setDisplayCredits(credits);
  }, [credits]);

  useEffect(() => {
    if (!celebration || celebration.profileId !== profileId) return;
    const start = creditsRef.current;
    const target = celebration.totalCredits ?? start + celebration.credits;
    setGlow(true);
    const controls = animate(start, target, {
      duration: 1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate(v) {
        setDisplayCredits(Math.round(v));
      },
      onComplete() {
        creditsRef.current = target;
      },
    });
    const glowTimer = setTimeout(() => setGlow(false), 1400);
    return () => {
      controls.stop();
      clearTimeout(glowTimer);
    };
  }, [celebration, profileId]);

  return (
    <div className="mt-2.5 flex items-center gap-3">
      <span
        className={`flex items-center gap-1.5 text-[15px] font-semibold ${
          emphasis === "likes" ? "text-white" : "text-white/75"
        }`}
      >
        <span className="text-base">👍</span>
        {likeCount.toLocaleString()}
        <span className="hidden text-xs font-medium text-white/70 sm:inline">Likes</span>
      </span>

      <span aria-hidden="true" className="h-4 w-px bg-white/30" />

      <motion.span
        animate={glow ? { scale: [1, 1.12, 1] } : {}}
        transition={{ duration: 0.5 }}
        className={`flex items-center gap-1.5 text-[15px] font-semibold tabular-nums ${
          emphasis === "credits" ? "text-white" : "text-white/75"
        } ${glow ? "drop-shadow-[0_0_10px_rgba(244,114,182,0.9)]" : ""}`}
      >
        <span className="text-base">💝</span>
        {displayCredits.toLocaleString()}
        <span className="hidden text-xs font-medium text-white/70 sm:inline">Credits</span>
      </motion.span>
    </div>
  );
}
