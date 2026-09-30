"use client";

import { useRef, useState } from "react";
import { initialsForName } from "@/lib/avatar";

type CoverVariant = "featured" | "card" | "compact" | "thumb" | "fullbleed" | "fill";

// Readability overlay for copy placed directly over a cover image.
// Cover-first rule: the artwork is always the primary visual surface at
// full color and full opacity — never a white wash, never a full-image
// dim, never blurred. Only the text zone gets a LOCAL dark gradient so
// faces/subjects keep 100% of their original color and detail.
type CoverOverlay = "dark-gradient" | "bottom-fade" | "top-fade" | "none";

// Local dark gradient: dark where the copy sits (left), fading to fully
// transparent so the subject area stays original.
const DARK_GRADIENT =
  "linear-gradient(90deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.42) 38%, rgba(0,0,0,0.12) 68%, rgba(0,0,0,0) 100%)";

const DEFAULT_OVERLAY: Record<CoverVariant, CoverOverlay> = {
  featured: "dark-gradient",
  card: "dark-gradient",
  compact: "dark-gradient",
  fullbleed: "bottom-fade",
  fill: "top-fade",
  thumb: "none",
};

// Visual cover for a ranking card. Cover priority (per approved mockup):
//   1. Ranking's cover image (AI editorial / manual / nominee-derived,
//      via cover_image_url when status is active/manual)
//   2. Top nominee's real photo
//   3. RepHear branded gradient + ranking initials (never broken)
export default function RankingCover({
  coverUrl,
  coverAlt,
  photoUrl,
  nomineeName,
  avatarColor,
  rankingTitle,
  variant,
  eager = false,
  overlay,
}: {
  coverUrl?: string | null;
  coverAlt?: string | null;
  photoUrl: string;
  nomineeName: string;
  avatarColor: string;
  rankingTitle: string;
  variant: CoverVariant;
  eager?: boolean;
  overlay?: CoverOverlay;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  // Priority 1: ranking cover image (AI editorial / manual). Priority 2:
  // top nominee photo. If the cover fails to load, fall through to the
  // nominee photo, then to the branded fallback.
  const coverSrc = coverUrl && !errored ? coverUrl : null;
  const hasPhoto = (!!coverSrc || (!!photoUrl && !errored));
  const imgSrc = coverSrc || photoUrl;
  const resolvedOverlay = overlay ?? DEFAULT_OVERLAY[variant];
  // Variants that render light copy over the image need a dark branded
  // fallback when no photo exists; the rest keep the light fallback.
  const darkFallback =
    variant === "featured" ||
    variant === "card" ||
    variant === "compact" ||
    variant === "fullbleed";
  const imgRef = useRef<HTMLImageElement | null>(null);

  // If the image already settled (loaded or failed) before React attached
  // onLoad/onError — e.g. it finished during SSR/hydration on a fast
  // connection — neither handler fires and the photo would stay invisible
  // forever behind `opacity-0`. Check on attach and recover.
  const checkSettled = () => {
    const el = imgRef.current;
    if (!el || !el.complete) return;
    if (el.naturalWidth > 0) setLoaded(true);
    else setErrored(true);
  };

  return (
    <div className="absolute inset-0 overflow-hidden">
      {hasPhoto ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={(el) => {
              imgRef.current = el;
              if (el) checkSettled();
            }}
            src={imgSrc}
            alt={coverSrc ? (coverAlt || "") : ""}
            aria-hidden={coverSrc ? "false" : "true"}
            referrerPolicy="no-referrer"
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={eager ? "high" : "auto"}
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
            className={`absolute left-0 top-0 h-full w-full object-cover object-top transition-[opacity,transform] duration-300 ease-out group-hover:scale-[1.04] ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
          />
          {/* Readability scrim (Layer 2): sits ABOVE the artwork, never
              replaces part of it. Local dark gradient where copy sits;
              the subject area stays at full original color. */}
          {resolvedOverlay === "dark-gradient" && (
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{ background: DARK_GRADIENT }}
            />
          )}
          {resolvedOverlay === "bottom-fade" && (
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent"
            />
          )}
          {resolvedOverlay === "top-fade" && (
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-transparent"
            />
          )}
        </>
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background: darkFallback
              ? `linear-gradient(135deg, ${avatarColor || "#3b2a6d"}, #111113 75%)`
              : "linear-gradient(135deg, #EFEAFF 0%, #E3ECFF 60%, #D9E4FF 100%)",
          }}
        >
          {/* Branded fallback: oversized ranking initials, right-positioned
              like a photo would be, plus soft brand-purple blobs. */}
          <div
            className={`absolute -right-4 top-1/2 -translate-y-1/2 select-none font-extrabold tracking-tighter ${
              darkFallback ? "text-white/15" : "text-brand/15"
            }`}
            style={{ fontSize: variant === "thumb" ? 44 : 120, lineHeight: 1 }}
          >
            {initialsForName(rankingTitle)}
          </div>
          {!darkFallback && (
            <>
              <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-brand/20 blur-2xl" />
              <div className="absolute -bottom-12 right-8 h-44 w-44 rounded-full bg-brand-deep/20 blur-2xl" />
            </>
          )}
          {darkFallback && (
            <div className="absolute -bottom-12 -right-8 h-52 w-52 rounded-full bg-brand/25 blur-3xl" />
          )}
        </div>
      )}
      {/* Keep the underlying nominee name available without inventing one. */}
      <span className="sr-only">
        {nomineeName ? `Cover photo: ${nomineeName}. ` : ""}
        {rankingTitle}
      </span>
    </div>
  );
}

// Re-exported so server components can pick the right variant/overlay
// without importing the client module's internals.
export type { CoverVariant, CoverOverlay };
