"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { likeAction } from "@/lib/actions/likes";
import { shareAction } from "@/lib/actions/shares";
import ShareProfileDialog from "@/components/ShareProfileDialog";

// Renders the Like + Share cluster for one Nominee. A user's first Like is
// free; after that the Like button stays disabled until they Share this
// Nominee (recorded once they actually copy the link or complete a native
// share from the Share dialog below), which unlocks exactly one more
// Like, and this repeats indefinitely (share again, unlock another Like).
// Both buttons live in one component because they share this unlock
// state.
//
// variant="pill" is the original labeled-button layout (kept for any
// future non-card usage). variant="icon" renders the same logic as two
// small glass icon buttons, meant to sit on top of a photo (used by the
// premium nominee cover card in NomineeCard) — Like first, then Share.
export default function LikeButton({
  rankingId,
  profileId,
  profileName,
  likeCount,
  allowedLikes,
  loggedIn,
  variant = "pill",
}: {
  rankingId: string;
  profileId: string;
  profileName?: string;
  likeCount: number;
  allowedLikes: number;
  loggedIn: boolean;
  variant?: "pill" | "icon";
}) {
  const [count, setCount] = useState(likeCount);
  const [allowed, setAllowed] = useState(allowedLikes);
  const [copied, setCopied] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canLike = count < allowed;

  function handleLike() {
    if (!canLike || pending) return;
    const prevCount = count;
    setCount(prevCount + 1);
    setError(null);
    startTransition(async () => {
      const result = await likeAction(rankingId, profileId);
      if (result.error) {
        setCount(prevCount);
        setError(result.error);
        if (typeof result.allowedLikes === "number") {
          setAllowed(result.allowedLikes);
        }
      } else if (typeof result.likeCount === "number") {
        setCount(result.likeCount);
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

  if (variant === "icon") {
    const iconButtonClass =
      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-[15px] leading-none text-white backdrop-blur-md transition hover:bg-white/30";

    if (!loggedIn) {
      return (
        <>
          <Link
            href="/login"
            title="Log in to Like"
            className={iconButtonClass}
            onClick={(e) => e.stopPropagation()}
          >
            👍
          </Link>
          <Link
            href="/login"
            title="Log in to Share"
            className={iconButtonClass}
            onClick={(e) => e.stopPropagation()}
          >
            ↗
          </Link>
        </>
      );
    }

    return (
      <>
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
            (!canLike ? "Share to Like again" : count > 0 ? `${count} Likes` : "Like")
          }
          className={`${iconButtonClass} ${!canLike ? "opacity-40" : ""}`}
        >
          <span className={count > 0 ? "" : "opacity-70"}>👍</span>
        </button>
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
          onShared={recordShare}
        />
      </>
    );
  }

  if (!loggedIn) {
    return (
      <span className="rounded-lg border border-border px-3 py-1.5 text-xs text-subtle">
        Log in to Like
      </span>
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
          {count > 0 ? `Liked (${count})` : "Like"}
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
