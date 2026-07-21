"use client";

import { useState, useTransition } from "react";
import { likeAction } from "@/lib/actions/likes";
import { shareAction } from "@/lib/actions/shares";

// Renders the Like + Share cluster for one Nominee. A user's first Like is
// free; after that the Like button stays disabled until they Share this
// Nominee (copying its link), which unlocks exactly one more Like, and
// this repeats indefinitely (share again, unlock another Like). Both
// buttons live in one component because they share this unlock state.
export default function LikeButton({
rankingId,
profileId,
likeCount,
allowedLikes,
loggedIn,
}: {
rankingId: string;
profileId: string;
likeCount: number;
allowedLikes: number;
loggedIn: boolean;
}) {
const [count, setCount] = useState(likeCount);
const [allowed, setAllowed] = useState(allowedLikes);
const [copied, setCopied] = useState(false);
const [error, setError] = useState<string | null>(null);
const [pending, startTransition] = useTransition();

if (!loggedIn) {
return (
<span className="rounded-lg border border-border px-3 py-1.5 text-xs text-subtle">
Log in to Like
</span>
);
}

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

function handleShare() {
const url = `${window.location.origin}/profiles/${profileId}`;
navigator.clipboard?.writeText(url).catch(() => {});
setCopied(true);
setTimeout(() => setCopied(false), 2000);
startTransition(async () => {
const result = await shareAction(rankingId, profileId);
if (result.error) {
setError(result.error);
} else if (typeof result.allowedLikes === "number") {
setAllowed(result.allowedLikes);
}
});
}

return (
<div className="flex flex-col items-end gap-1">
<div className="flex items-center gap-2">
<button
disabled={!canLike || pending}
onClick={handleLike}
className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
!canLike
? "border-border bg-surface text-subtle"
: "border-ink text-ink hover:bg-ink hover:text-white"
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
{!canLike && (
<p className="max-w-[11rem] text-right text-[11px] text-subtle">
Share to Like again
</p>
)}
{error && (
<p className="max-w-[11rem] text-right text-[11px] text-red-600">
{error}
</p>
)}
</div>
);
}
"