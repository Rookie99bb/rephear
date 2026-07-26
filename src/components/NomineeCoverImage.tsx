"use client";

import { useState } from "react";
import Link from "next/link";
import { initialsForName } from "@/lib/avatar";

// Full-bleed cover photo for a premium nominee card. Fades in once the
// image finishes loading; if photoUrl is empty (nominated without a
// photo, the common case today — see AddNomineeForm) or the URL 404s,
// falls back to a generated gradient + large-initial placeholder rather
// than a broken image or a plain grey circle.
export default function NomineeCoverImage({
  name,
  photoUrl,
  avatarColor,
  claimed,
  profileId,
  loggedIn,
}: {
  name: string;
  photoUrl: string;
  avatarColor: string;
  claimed: boolean;
  profileId: string;
  loggedIn: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const hasPhoto = !!photoUrl && !errored;

  if (!hasPhoto) {
    return (
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white"
        style={{
          background: `linear-gradient(160deg, ${avatarColor}, #111113)`,
        }}
      >
        <span className="text-7xl font-semibold tracking-tight text-white/90">
          {initialsForName(name)}
        </span>
        {!claimed ? (
          <>
            <span className="text-xs font-medium uppercase tracking-wide text-white/60">
              No Photo Yet
            </span>
            {loggedIn && (
              <Link
                href={`/profiles/${profileId}/claim`}
                onClick={(e) => e.stopPropagation()}
                className="relative z-20 mt-1 rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-md transition hover:bg-white/30"
              >
                Claim Profile
              </Link>
            )}
          </>
        ) : (
          <span className="text-xs font-medium uppercase tracking-wide text-white/60">
            No Photo Yet
          </span>
        )}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl}
      alt={name}
      onLoad={() => setLoaded(true)}
      onError={() => setErrored(true)}
      className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-[250ms] ease-out group-hover:scale-105 ${
        loaded ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}
