"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import NomineePlaceholderArt from "@/components/NomineePlaceholderArt";
import type { PlaceholderArtTheme } from "@/lib/nomineeMeta";

// Full-bleed cover photo for a premium nominee card. Fades in once the
// image finishes loading; if photoUrl is empty (nominated without a
// photo, the common case today — see AddNomineeForm) or the URL 404s,
// falls back to category-aware placeholder art (Phase 4) rather than a
// broken image. Three states stay visually distinct:
//   - no photo data  → "{Category} · Photo coming soon"
//   - URL present but failed to load → "Couldn't load photo" + retry
// The card never crashes on a missing/broken image.
export default function NomineeCoverImage({
  name,
  photoUrl,
  avatarColor,
  claimed,
  profileId,
  loggedIn,
  placeholderTheme,
  categorySlug,
  priority = false,
}: {
  name: string;
  photoUrl: string;
  avatarColor: string;
  claimed: boolean;
  profileId: string;
  loggedIn: boolean;
  /** Decorative placeholder-art theme from the ranking's category (no entity claim). */
  placeholderTheme: PlaceholderArtTheme;
  /** Category slug for the placeholder label ("Cosplay", "Anime", …). */
  categorySlug: string;
  // Above-the-fold cards pass priority so the first few covers load
  // eagerly; everything else lazy-loads to keep mobile LCP down.
  priority?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const hasPhoto = !!photoUrl && !errored;
  const imgRef = useRef<HTMLImageElement | null>(null);

  // If the image already settled (loaded or failed) before React attached
  // onLoad/onError — e.g. it finished during SSR/hydration on a fast
  // connection — neither handler fires and the photo would stay invisible
  // forever behind `opacity-0`. Check on mount and recover.
  const checkSettled = () => {
    const el = imgRef.current;
    if (!el || !el.complete) return;
    if (el.naturalWidth > 0) setLoaded(true);
    else setErrored(true);
  };

  if (!hasPhoto) {
    const broken = !!photoUrl && errored;
    return (
      <>
        <NomineePlaceholderArt
          theme={placeholderTheme}
          categorySlug={categorySlug}
          name={name}
          avatarColor={avatarColor}
          status={broken ? "broken" : "missing"}
          onRetry={broken ? () => setErrored(false) : undefined}
        />
        {/* Below-art affordance: keep the existing claim CTA. */}
        <div className="absolute inset-x-0 bottom-3 z-20 flex flex-col items-center">
          {!claimed && loggedIn && (
            <Link
              href={`/profiles/${profileId}/claim`}
              onClick={(e) => e.stopPropagation()}
              className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-md transition hover:bg-white/30"
            >
              Claim Profile
            </Link>
          )}
        </div>
      </>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={(el) => {
        imgRef.current = el;
        if (el) checkSettled();
      }}
      src={photoUrl}
      alt={name}
      referrerPolicy="no-referrer"
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      onLoad={() => setLoaded(true)}
      onError={() => setErrored(true)}
      className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-[250ms] ease-out group-hover:scale-105 ${
        loaded ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}
