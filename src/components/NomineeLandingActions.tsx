"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { likeAction } from "@/lib/actions/likes";

// The two hero CTAs on the nominee share landing page (/n/TOKEN):
// [免费点赞] and [Credits支持]. Same backend as the ranking cards
// (likeAction unlock rules apply: first like free, share to like again).
export default function NomineeLandingActions({
  rankingId,
  profileId,
  profileName,
  initialMyLikes,
  initialAllowedLikes,
  loggedIn,
}: {
  rankingId: string;
  profileId: string;
  profileName: string;
  initialMyLikes: number;
  initialAllowedLikes: number;
  loggedIn: boolean;
}) {
  const [myLikes, setMyLikes] = useState(initialMyLikes);
  const [allowed, setAllowed] = useState(initialAllowedLikes);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canLike = myLikes < allowed;

  function handleLike() {
    if (!canLike || pending) return;
    const prev = myLikes;
    setMyLikes(prev + 1);
    setError(null);
    startTransition(async () => {
      const result = await likeAction(rankingId, profileId);
      if (result.error) {
        setMyLikes(prev);
        setError(result.error);
        if (typeof result.allowedLikes === "number") {
          setAllowed(result.allowedLikes);
        }
      } else {
        if (typeof result.likeCount === "number") setMyLikes(result.likeCount);
        if (typeof result.allowedLikes === "number") setAllowed(result.allowedLikes);
      }
    });
  }

  const supportHref = loggedIn
    ? `/rankings/${rankingId}/support/${profileId}`
    : "/login";

  return (
    <div className="flex w-full flex-col gap-3">
      {loggedIn ? (
        <button
          type="button"
          onClick={handleLike}
          disabled={!canLike || pending}
          className={`w-full rounded-2xl px-6 py-4 text-base font-semibold transition active:scale-[0.98] ${
            canLike
              ? "bg-ink text-white hover:opacity-90"
              : "cursor-not-allowed bg-surface text-subtle"
          }`}
        >
          👍 免费点赞{myLikes > 0 ? ` (${myLikes})` : ""}
        </button>
      ) : (
        <Link
          href="/login"
          className="w-full rounded-2xl bg-ink px-6 py-4 text-center text-base font-semibold text-white transition hover:opacity-90 active:scale-[0.98]"
        >
          👍 免费点赞
        </Link>
      )}
      {!canLike && loggedIn && (
        <p className="-mt-1 text-xs text-subtle">
          分享 {profileName} 的专属链接可以再点赞一次
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}

      <Link
        href={supportHref}
        className="w-full rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-4 text-center text-base font-semibold text-white shadow-[0_8px_24px_-8px_rgba(219,39,119,0.7)] transition hover:opacity-95 active:scale-[0.98]"
      >
        💝 Credits 支持
      </Link>
    </div>
  );
}
