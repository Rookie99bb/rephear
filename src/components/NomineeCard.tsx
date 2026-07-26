import Link from "next/link";
import NomineeCoverImage from "@/components/NomineeCoverImage";
import LikeButton from "@/components/LikeButton";
import type { LeaderboardEntry } from "@/lib/types";

// Premium, full-photo "magazine cover" nominee card. Replaces the old
// text-first list row. The whole card is one stretched link to the
// profile (an absolutely-positioned <Link> underneath everything else,
// z-10). Every interactive control (Like, Share, More, Claim) is a
// separate sibling positioned on top of it at a higher z-index — since
// they aren't nested inside the stretched link, clicking one only
// triggers its own action/navigation, never both.
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
}) {
  const { profile } = entry;
  const podium = podiumStyles(rank);

  return (
    <li
      className={`group relative aspect-[4/5] list-none overflow-hidden rounded-3xl bg-surface shadow-[0_8px_24px_-12px_rgba(17,17,19,0.35)] transition-transform duration-[250ms] ease-out hover:-translate-y-2 hover:shadow-[0_28px_48px_-16px_rgba(17,17,19,0.45)] ${podium.card}`}
    >
      {/* Stretched link: the whole card navigates to the profile. */}
      <Link
        href={`/profiles/${profile.id}`}
        className="absolute inset-0 z-10"
        aria-label={`View ${profile.name}'s profile`}
      />

      <NomineeCoverImage
        name={profile.name}
        photoUrl={profile.photoUrl}
        avatarColor={profile.avatarColor}
        claimed={profile.claimStatus === "claimed"}
        profileId={profile.id}
        loggedIn={loggedIn}
      />

      {/* Premium gradient overlay: transparent at top, fully readable
          at the bottom, confined to the bottom 40% of the card. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[15] h-[40%] bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

      {/* Top-left: rank badge */}
      <div className="absolute left-3 top-3 z-20">
        <span className="inline-flex items-center rounded-full bg-black/35 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md">
          {rankBadgeLabel(rank)}
        </span>
      </div>

      {/* Top-right: Like / Share / More */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
        <LikeButton
          rankingId={rankingId}
          profileId={profile.id}
          likeCount={likeCount}
          allowedLikes={allowedLikes}
          loggedIn={loggedIn}
          variant="icon"
        />
        <Link
          href={
            loggedIn
              ? `/rankings/${rankingId}/support/${profile.id}`
              : "/login"
          }
          title={loggedIn ? "Support" : "Log in to Support"}
          className="relative z-20 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-[15px] leading-none text-white backdrop-blur-md transition hover:bg-white/30"
        >
          ⋯
        </Link>
      </div>

      {/* Bottom overlay: name, verified badge, city, stats */}
      <div className="absolute inset-x-0 bottom-0 z-20 p-4 sm:p-5">
        <p className="flex items-center gap-1.5 text-xl font-bold leading-tight tracking-tight text-white sm:text-2xl">
          <span className="truncate">{profile.name}</span>
          {profile.claimStatus === "claimed" && <VerifiedBadge />}
        </p>
        <p className="mt-0.5 truncate text-sm text-white/80">
          {city}
          {country ? `, ${country}` : ""}
        </p>
        <div className="mt-2 flex items-center gap-3 text-[13px] font-medium text-white/95">
          <span className={emphasis === "likes" ? "text-white" : "text-white/70"}>
            ❤️ {entry.likeCount.toLocaleString()} Likes
          </span>
          <span className={emphasis === "credits" ? "text-white" : "text-white/70"}>
            💝 {entry.reputationCredits.toLocaleString()} Credits
          </span>
        </div>
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
