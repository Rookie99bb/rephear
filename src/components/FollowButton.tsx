"use client";

import { useState, useTransition } from "react";

// Phase 3 (§19): follow button for rankings + communities (categories).
// User-follows are out of scope and unreachable — the API allowlists
// targetType. Logged-out visitors get a sign-in prompt state instead.
export default function FollowButton({
  targetType,
  targetId,
  targetName,
  initialFollowing,
  loggedIn,
}: {
  targetType: "ranking" | "category";
  targetId: string;
  targetName: string;
  initialFollowing: boolean;
  loggedIn: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    if (!loggedIn || pending) return;
    setError(null);
    const next = !following;
    setFollowing(next); // optimistic
    startTransition(async () => {
      try {
        const res = next
          ? await fetch("/api/follows", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ targetType, targetId }),
            })
          : await fetch(
              `/api/follows/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`,
              { method: "DELETE" }
            );
        if (!res.ok) {
          setFollowing(!next);
          setError("Couldn't update your follow. Try again.");
        }
      } catch {
        setFollowing(!next);
        setError("Couldn't update your follow. Try again.");
      }
    });
  }

  if (!loggedIn) {
    return (
      <a
        href="/api/auth/signin"
        className="rounded-full border border-border px-4 py-1.5 text-sm font-medium hover:bg-black/[0.04]"
        title={`Sign in to follow ${targetName}`}
      >
        ＋ Follow
      </a>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={toggle}
        disabled={pending}
        aria-pressed={following}
        className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
          following
            ? "bg-black text-white hover:bg-black/80"
            : "border border-border hover:bg-black/[0.04]"
        } ${pending ? "opacity-60" : ""}`}
      >
        {following ? "✓ Following" : "＋ Follow"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
