"use client";

import { useState, useTransition } from "react";
import { shareAction } from "@/lib/actions/shares";
import ShareProfileDialog from "@/components/ShareProfileDialog";

// Standalone Share button for the nominee card action area (per the
// approved mockup: Share is SECONDARY, below Like/Support). Extracted
// from LikeButton so the card can render Share independently.
//
// variant="card" renders the mockup's secondary treatment: neutral but
// clearly visible, with a "Share" label. The Like-unlock side effect
// (recordShare -> unlocks one more Like) is preserved when logged in.
export default function ShareProfileButton({
  rankingId,
  profileId,
  profileName,
  loggedIn,
  variant = "card",
}: {
  rankingId: string;
  profileId: string;
  profileName?: string;
  loggedIn: boolean;
  variant?: "card" | "icon";
}) {
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [, startTransition] = useTransition();

  function recordShare() {
    startTransition(async () => {
      await shareAction(rankingId, profileId);
    });
  }

  function openDialog(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setShareDialogOpen(true);
  }

  if (variant === "icon") {
    return (
      <>
        <button
          type="button"
          onClick={openDialog}
          title="Share"
          aria-label="Share this nominee"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-[15px] leading-none text-white backdrop-blur-md transition hover:bg-white/30"
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

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        aria-label={copied ? "Link copied" : "Share this nominee"}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-ink/30 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <span aria-hidden="true">↗</span>
        {copied ? "Copied!" : "Share"}
      </button>
      <ShareProfileDialog
        open={shareDialogOpen}
        onOpenChange={(open) => {
          setShareDialogOpen(open);
          if (!open) {
            // Dialog closed after a real share/copy: reflect it briefly.
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }
        }}
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
