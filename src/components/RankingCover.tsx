"use client";

import { useState } from "react";

// Cover image for a ranking card / banner. Guaranteed non-broken:
// if the primary URL fails to load, falls back through the chain
// (category art -> neutral RepHear art). Lazy-loads below the fold and
// reserves its aspect ratio to prevent layout shift.
export default function RankingCover({
  src,
  alt,
  fallbackSrc,
  neutralSrc = "/covers/categories/other-card.webp",
  className = "",
  eager = false,
}: {
  src: string;
  alt: string;
  fallbackSrc: string;
  neutralSrc?: string;
  className?: string;
  eager?: boolean;
}) {
  const [stage, setStage] = useState(0);
  const current = stage === 0 ? src : stage === 1 ? fallbackSrc : neutralSrc;
  return (
    <img
      src={current}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      onError={() => setStage((s) => (s < 2 ? s + 1 : s))}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}
