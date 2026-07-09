"use client";

import { useState, useTransition } from "react";
import { likeAction } from "@/lib/actions/likes";

export default function LikeButton({
  rankingId,
  profileId,
  initiallyLiked,
  loggedIn,
}: {
  rankingId: string;
  profileId: string;
  initiallyLiked: boolean;
  loggedIn: boolean;
}) {
  const [liked, setLiked] = useState(initiallyLiked);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!loggedIn) {
    return (
      <span className="rounded-lg border border-border px-3 py-1.5 text-xs text-subtle">
        Log in to Like
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        disabled={liked || pending}
        onClick={() => {
          setLiked(true);
          setError(null);
          startTransition(async () => {
            const result = await likeAction(rankingId, profileId);
            if (result.error) {
              // Roll back the optimistic update — the server rejected it
              // (e.g. rate limited).
              setLiked(false);
              setError(result.error);
            }
          });
        }}
        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
          liked
            ? "border-border bg-surface text-subtle"
            : "border-ink text-ink hover:bg-ink hover:text-white"
        }`}
      >
        {liked ? "Liked" : "Like"}
      </button>
      {error && <p className="max-w-[10rem] text-right text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
