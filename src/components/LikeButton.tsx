"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { likeAction } from "@/lib/actions/likes";
import { shareAction } from "@/lib/actions/shares";
import ShareProfileDialog from "@/components/ShareProfileDialog";
import {
  formatLikeCountLabel,
  canCastLike,
  applyOptimisticLike,
  resolveLikeUpdate,
  type LikeDisplayState,
} from "@/lib/likeDisplay";
import { subscribeLikeChannel, publishLikeState } from "@/lib/likeSync";

// Renders the Like + Share cluster for one Nominee. A user's first Like is
// free; after that the Like button stays disabled until they Share this
// Nominee (recorded once they actually copy the link or complete a native
// share from the Share dialog below), which unlocks exactly one more
// Like, and this repeats indefinitely (share again, unlock another Like).
// Both buttons live in one component because they share this unlock
// state.
//
// DISPLAY CONTRACT (like-data contract 方案C, 2026-10-01): the card
// ALWAYS shows the nominee's PUBLIC *organic* Like total
// (`publicOrganicLikeCount`) — real user Likes only, never seed.
// Logged-out visitors see the real number too, and 0 is shown explicitly
// as `❤️ Like · 0`, never hidden. `userLikeCount` / `hasLiked` (THIS
// viewer's own state) only drive the button state (canLike / liked) and
// are never rendered as the count. likeAction returns the
// server-authoritative public organic total plus the viewer's
// authoritative state, so the optimistic +1 converges to the number
// everyone sees; on failure the optimistic update rolls back exactly.
// Sibling instances (Most Loved + Most Supported cards for the same
// nominee) stay in sync through the likeSync pub/sub channel.
//
// variant="pill" is the original labeled-button layout (kept for any
// future non-card usage). variant="icon" renders the same logic as two
// small glass icon buttons, meant to sit on top of a photo (used by the
// premium nominee cover card in NomineeCard) — Like first, then Share.
// variant="card" is the APPROVED mockup treatment: a vivid pink/red
// filled pill with a heart, rendered BELOW the nominee image in the
// card's action area (never floating over the face). Share is rendered
// separately via ShareProfileButton.
export default function LikeButton({
  rankingId,
  profileId,
  profileName,
  publicOrganicLikeCount,
  userLikeCount,
  allowedLikes,
  loggedIn,
  variant = "pill",
}: {
  rankingId: string;
  profileId: string;
  profileName?: string;
  /** Public ORGANIC Like total — displayed on the card for every visitor. Never includes seed. */
  publicOrganicLikeCount: number;
  /** Viewer's own Like count — button gating only, never displayed. */
  userLikeCount: number;
  allowedLikes: number;
  loggedIn: boolean;
  variant?: "pill" | "icon" | "card";
}) {
  const [display, setDisplay] = useState<LikeDisplayState>({
    total: publicOrganicLikeCount,
    userCount: userLikeCount,
    hasLiked: userLikeCount > 0,
  });
  const [allowed, setAllowed] = useState(allowedLikes);
  const [copied, setCopied] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // The exact listener identity registered on the channel, so publish()
  // can exclude this instance (no self-echo).
  const listenerRef = useRef<((state: LikeDisplayState) => void) | null>(null);

  const canLike = canCastLike(loggedIn, display.userCount, allowed);
  const liked = loggedIn && display.hasLiked;

  // Adopt state published by a sibling <LikeButton> for the same nominee
  // (Most Loved card <-> Most Supported card): optimistic +1s, server
  // reconciles and failure rollbacks all propagate.
  useEffect(() => {
    const listener = (state: LikeDisplayState) => setDisplay(state);
    listenerRef.current = listener;
    return subscribeLikeChannel(rankingId, profileId, listener);
  }, [rankingId, profileId]);

  function publish(state: LikeDisplayState) {
    publishLikeState(
      rankingId,
      profileId,
      state,
      listenerRef.current ?? undefined
    );
  }

  function handleLike() {
    if (!canLike || pending) return;
    const before = display;
    const optimistic = applyOptimisticLike(before);
    setDisplay(optimistic);
    publish(optimistic);
    setError(null);
    startTransition(async () => {
      const result = await likeAction(rankingId, profileId);
      const resolved = resolveLikeUpdate(before, optimistic, result);
      setDisplay(resolved);
      // Publish the resolved state too: on success siblings converge to
      // the server-authoritative totals; on failure they roll back with us.
      publish(resolved);
      if (result.error) {
        setError(result.error);
        if (typeof result.allowedLikes === "number") {
          setAllowed(result.allowedLikes);
        }
      } else if (typeof result.allowedLikes === "number") {
        setAllowed(result.allowedLikes);
      }
    });
  }

  // Records a Share with the backend and unlocks the next Like. Shared by
  // both the pill variant's own copy-link button and (via onShared, below)
  // the icon variant's Share dialog, which handles the actual copy /
  // native-share UI itself and just calls back here once it's done.
  function recordShare() {
    startTransition(async () => {
      const result = await shareAction(rankingId, profileId);
      if (result.error) {
        setError(result.error);
      } else if (typeof result.allowedLikes === "number") {
        setAllowed(result.allowedLikes);
      }
    });
  }

  function handleShare() {
    const url = `${window.location.origin}/profiles/${profileId}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    recordShare();
  }

  if (variant === "card") {
    // Approved mockup: vivid pink/red filled pill, heart icon, PUBLIC
    // organic count — always visible, even for logged-out visitors and at 0.
    const cardClass =
      "inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-[0_6px_16px_-4px_rgba(219,39,119,0.6)] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600 active:scale-95 " +
      (canLike && !pending
        ? "bg-gradient-to-br from-pink-500 via-rose-500 to-pink-600 hover:shadow-[0_10px_22px_-4px_rgba(219,39,119,0.8)]"
        : "cursor-not-allowed bg-pink-300 opacity-60");
    const label = formatLikeCountLabel(display.total);

    if (!loggedIn) {
      return (
        <Link
          href="/login"
          aria-label={`Log in to Like this nominee (${label})`}
          title={error ?? label}
          className={cardClass + " bg-gradient-to-br from-pink-500 via-rose-500 to-pink-600"}
          onClick={(e) => e.stopPropagation()}
        >
          <span aria-hidden="true">❤️</span>
          {label.replace("❤️ ", "")}
        </Link>
      );
    }
    return (
      <button
        type="button"
        disabled={!canLike || pending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleLike();
        }}
        title={error ?? (!canLike ? "Share to Like again" : label)}
        aria-label={liked ? `Liked (${label})` : `Like this nominee (${label})`}
        aria-pressed={liked}
        className={cardClass}
      >
        <span aria-hidden="true">❤️</span>
        {label.replace("❤️ ", "")}
      </button>
    );
  }

  if (variant === "icon") {
    const iconButtonClass =
      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-[15px] leading-none text-white backdrop-blur-md transition hover:bg-white/30";
    // Like gets its own vivid, colorful treatment -- same premium
    // "not just glass" idea as SupportButton.tsx, in gold rather than
    // pink so the two stay visually distinct while both reading as
    // prominent, alive actions (as opposed to the plain glass Share/More).
    const likeButtonClass =
      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 text-[16px] leading-none text-white shadow-[0_6px_16px_-4px_rgba(180,83,9,0.7)] ring-1 ring-white/40 backdrop-blur-md transition hover:scale-110 hover:shadow-[0_10px_22px_-4px_rgba(180,83,9,0.85)] active:scale-95";

    // Share needs no account — it's just "copy this link" — and gating
    // it behind /login was actively hostile to the growth loop the Share
    // button exists for (see the optimization review: a logged-out
    // visitor who wants to share a profile got bounced to login instead
    // of a copyable link). Only Like stays gated, since it's the one
    // action that actually needs an account. Anonymous shares still open
    // the same dialog; they just don't call recordShare() (that only
    // exists to unlock extra Likes for the sharer, which is meaningless
    // without an account).
    return (
      <>
        {loggedIn ? (
          <button
            type="button"
            disabled={!canLike || pending}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleLike();
            }}
            title={
              error ??
              (!canLike ? "Share to Like again" : `${display.total} Likes`)
            }
            className={`${likeButtonClass} ${!canLike ? "opacity-40" : ""}`}
          >
            👍
          </button>
        ) : (
          <Link
            href="/login"
            title={`Log in to Like (${display.total} Likes)`}
            className={likeButtonClass}
            onClick={(e) => e.stopPropagation()}
          >
            👍
          </Link>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShareDialogOpen(true);
          }}
          title="Share"
          className={iconButtonClass}
        >
          ↗
        </button>
        <ShareProfileDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          profileUrl={
            typeof window !== "undefined"
              ? `${window.location.origin}/profiles/${profileId}`
              : `/profiles/${profileId}`
          }
          profileName={profileName}
          onShared={loggedIn ? recordShare : undefined}
        />
      </>
    );
  }

  if (!loggedIn) {
    return (
      <Link
        href="/login"
        title={`Log in to Like (${formatLikeCountLabel(display.total)})`}
        className="rounded-lg border border-border px-3 py-1.5 text-xs text-subtle transition hover:border-ink hover:text-ink"
      >
        {formatLikeCountLabel(display.total)}
      </Link>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button
          disabled={!canLike || pending}
          onClick={handleLike}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            !canLike ? "border-border bg-surface text-subtle" : "border-ink text-ink hover:bg-ink hover:text-white"
          }`}
        >
          {liked ? `Liked (${display.total})` : `Like (${display.total})`}
        </button>
        <button
          onClick={handleShare}
          className="rounded-lg border border-amber-900 px-3 py-1.5 text-xs font-medium text-amber-900 transition hover:bg-amber-900 hover:text-white"
        >
          {copied ? "Link copied!" : "Share"}
        </button>
      </div>
      {!canLike && <p className="max-w-[11rem] text-right text-[11px] text-subtle">Share to Like again</p>}
      {error && <p className="max-w-[11rem] text-right text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
