import Link from "next/link";
import NomineeCoverImage from "@/components/NomineeCoverImage";
import LikeButton from "@/components/LikeButton";
import SupportButton from "@/components/SupportButton";
import ShareProfileButton from "@/components/ShareProfileButton";
import NomineeCardGlow from "@/components/NomineeCardGlow";
import type { LeaderboardEntry } from "@/lib/types";

// Nominee card per the approved visual mockup: photo-forward, with the
// rank badge (#1/#2/#3) as the ONLY overlay on the image. All primary
// interaction controls (Like / Support / Share / More) live BELOW the
// image in a clearly separated action area — never floating over the
// nominee's face.
//
// Layout:
//   [ NOMINEE IMAGE ]          <- rank badge top-left only
//   ---------------------------
//   Nominee Name
//   City, Country
//   [❤️ Like 4.8K] [🪙 Support]
//   [↗ Share]            [•••]
//
// Like = pink/red filled pill with heart. Support = gold/yellow filled
// pill. Share = secondary. More = tertiary icon-only.
//
// This component has no "use client" directive — it's a Server
// Component, rendered per-Nominee on the server. Do NOT add inline
// event handlers (onClick, etc.) to anything in this file, including
// props passed to <Link>: Next.js throws "Event handlers cannot be
// passed to Client Component props" at request time for dynamic routes,
// which `next build` does NOT catch. Any control that truly needs
// client-side interactivity belongs in its own small "use client"
// component instead — see SupportButton.tsx, LikeButton.tsx,
// ShareProfileButton.tsx and NomineeCardGlow.tsx for the pattern.
export default function NomineeCard({
  rank,
  entry,
  city,
  country,
  rankingId,
  likeCount,
  allowedLikes,
  loggedIn,
  emphasis,
  priority = false,
  creditsGap = null,
  movement = null,
}: {
  rank: number;
  entry: LeaderboardEntry;
  city: string;
  country: string;
  rankingId: string;
  likeCount: number;
  allowedLikes: number;
  loggedIn: boolean;
  emphasis: "likes" | "credits";
  // Set for above-the-fold cards so their cover image loads eagerly.
  priority?: boolean;
  // Most Supported board only: credits behind the rank directly above
  // (null for #1 and for the Most Loved board). Rendered as a plain
  // server-side line — no interactivity needed.
  creditsGap?: number | null;
  // Phase 3 (§23/§26): rank movement vs the previous daily snapshot
  // (from ranking_snapshots). Undefined = no snapshot data = no arrow
  // (never infer movement from a single data point).
  movement?: { direction: "up" | "down" | "same" | "new"; delta: number } | null;
}) {
  const { profile } = entry;
  const podium = podiumStyles(rank);

  return (
    <li
      className={`group relative list-none overflow-hidden rounded-3xl bg-white shadow-[0_8px_24px_-12px_rgba(17,17,19,0.25)] transition-transform duration-[250ms] ease-out hover:-translate-y-1 hover:shadow-[0_28px_48px_-16px_rgba(17,17,19,0.35)] ${podium.card}`}
    >
      {/* Image area: photo is the hero. Only the rank badge overlays it. */}
      <div className="relative aspect-[4/5] overflow-hidden">
        {/* Stretched link: the image area navigates to the profile. */}
        <Link
          href={`/profiles/${profile.id}`}
          className="absolute inset-0 z-10"
          aria-label={`View ${profile.name}'s profile`}
          tabIndex={-1}
        />

        <NomineeCoverImage
          name={profile.name}
          photoUrl={profile.photoUrl}
          avatarColor={profile.avatarColor}
          claimed={profile.claimStatus === "claimed"}
          profileId={profile.id}
          loggedIn={loggedIn}
          priority={priority}
        />

        {/* Pink glow ring, lit up for ~1s the instant this profile's
            Support is confirmed elsewhere on the page. */}
        <NomineeCardGlow profileId={profile.id} />

        {/* Top-left: rank badge + movement arrow ONLY. No action buttons
            over the image — they live in the action area below. */}
        <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5">
          <span className="inline-flex items-center rounded-full bg-black/35 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md">
            {rankBadgeLabel(rank)}
          </span>
          {movement && movement.direction !== "same" && (
            <span
              title={movementTitle(movement)}
              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-bold backdrop-blur-md ${
                movement.direction === "up"
                  ? "bg-green-600/70 text-white"
                  : movement.direction === "down"
                    ? "bg-red-600/70 text-white"
                    : "bg-blue-600/70 text-white"
              }`}
            >
              {movement.direction === "up" && `↑ ${movement.delta}`}
              {movement.direction === "down" && `↓ ${movement.delta}`}
              {movement.direction === "new" && "NEW"}
            </span>
          )}
        </div>
      </div>

      {/* Content + action area: clearly separated below the image. */}
      <div className="relative z-20 p-4 sm:p-5">
        {/* Stretched link for the text area (separate from image link so
            the action buttons below remain independently clickable). */}
        <Link
          href={`/profiles/${profile.id}`}
          className="absolute inset-0 z-10"
          aria-label={`View ${profile.name}'s profile`}
          tabIndex={-1}
        />

        <p className="flex items-center gap-1.5 text-lg font-bold leading-tight tracking-tight text-ink sm:text-xl">
          <span className="truncate">{profile.name}</span>
          {profile.claimStatus === "claimed" && <VerifiedBadge />}
        </p>
        <p className="mt-0.5 truncate text-sm text-subtle">
          {city}
          {country ? `, ${country}` : ""}
        </p>

        {/* Primary actions: Like (pink) + Support (gold). */}
        <div className="relative z-20 mt-3 flex items-center gap-2">
          <LikeButton
            rankingId={rankingId}
            profileId={profile.id}
            profileName={profile.name}
            likeCount={likeCount}
            allowedLikes={allowedLikes}
            loggedIn={loggedIn}
            variant="card"
          />
          <SupportButton
            rankingId={rankingId}
            profileId={profile.id}
            loggedIn={loggedIn}
            variant="card"
            credits={entry.reputationCredits}
          />
        </div>

        {/* Secondary actions: Share + More. */}
        <div className="relative z-20 mt-2 flex items-center justify-between">
          <ShareProfileButton
            rankingId={rankingId}
            profileId={profile.id}
            profileName={profile.name}
            loggedIn={loggedIn}
            variant="card"
          />
          <button
            type="button"
            title="More"
            aria-haspopup="true"
            aria-label="More actions"
            className="flex h-9 w-9 items-center justify-center rounded-full text-lg leading-none text-subtle transition hover:bg-surface hover:text-ink"
          >
            •••
          </button>
        </div>

        {emphasis === "credits" && creditsGap != null && (
          <p className="mt-2 text-xs font-medium text-subtle">
            {creditsGap > 0
              ? `${creditsGap.toLocaleString()} credits away from #${rank - 1}`
              : `Tied with #${rank - 1}`}
          </p>
        )}
      </div>
    </li>
  );
}

function rankBadgeLabel(rank: number): string {
  if (rank === 1) return "🥇 #1";
  if (rank === 2) return "🥈 #2";
  if (rank === 3) return "🥉 #3";
  return `#${rank}`;
}

// Phase 3: accessible label for the movement arrow — always describes
// the snapshot-backed change, never implies a cause. (Says "last
// snapshot", not "yesterday": the cron may occasionally skip a day.)
function movementTitle(movement: {
  direction: "up" | "down" | "same" | "new";
  delta: number;
}): string {
  if (movement.direction === "up")
    return `Up ${movement.delta} since the last snapshot`;
  if (movement.direction === "down")
    return `Down ${movement.delta} since the last snapshot`;
  return "New to this ranking";
}

function podiumStyles(rank: number): { card: string } {
  // Elegant, not flashy: a soft colored ring + glow, and a touch of
  // extra size on large screens for the top three. Scoped to lg: so it
  // never causes overlap on cramped single/two-column layouts.
  if (rank === 1) {
    return {
      card:
        "ring-1 ring-gold shadow-[0_0_0_1px_rgba(184,134,11,0.4),0_20px_40px_-14px_rgba(184,134,11,0.45)] lg:origin-center lg:scale-[1.08]",
    };
  }
  if (rank === 2) {
    return {
      card:
        "ring-1 ring-slate-300 shadow-[0_0_0_1px_rgba(148,163,184,0.4),0_16px_32px_-14px_rgba(148,163,184,0.4)] lg:origin-center lg:scale-[1.03]",
    };
  }
  if (rank === 3) {
    return {
      card:
        "ring-1 ring-[#cd7f32] shadow-[0_0_0_1px_rgba(205,127,50,0.4),0_16px_32px_-14px_rgba(205,127,50,0.4)]",
    };
  }
  return { card: "" };
}

function VerifiedBadge() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4 shrink-0 text-sky-400"
      aria-label="Verified"
    >
      <title>Verified</title>
      <path
        fillRule="evenodd"
        d="M10 1.5l2.11 1.2 2.43-.2 1.02 2.2 2.2 1.02-.2 2.43L18.76 10l-1.2 2.11.2 2.43-2.2 1.02-1.02 2.2-2.43-.2L10 18.76l-2.11-1.2-2.43.2-1.02-2.2-2.2-1.02.2-2.43L1.24 10l1.2-2.11-.2-2.43 2.2-1.02 1.02-2.2 2.43.2L10 1.5zm3.28 6.22a.75.75 0 00-1.06-1.06L9 9.88 7.28 8.16a.75.75 0 10-1.06 1.06l2.25 2.25a.75.75 0 001.06 0l3.75-3.75z"
        clipRule="evenodd"
      />
    </svg>
  );
}
