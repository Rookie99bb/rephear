"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";

// Share dialog for a Nominee's public profile link. Opened by the Share
// (↗) icon on a NomineeCard instead of copying the link immediately, so
// the user can see exactly what they're about to send out before it
// happens. "Copy Link" always works; the native navigator.share() sheet
// is offered as a second option only when the browser supports it
// (mostly mobile — desktop browsers largely don't implement it).
export default function ShareProfileDialog({
  open,
  onOpenChange,
  profileUrl,
  profileName,
  onShared,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileUrl: string;
  profileName?: string;
  onShared?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setCanNativeShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function"
    );
  }, []);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onShared?.();
    } catch {
      // Clipboard API can fail (permissions, insecure context, etc.) —
      // fail quietly, the link is still visible and selectable by hand.
    }
  }

  async function handleNativeShare() {
    try {
      await navigator.share({
        title: profileName ? `${profileName} on RepHear` : "RepHear profile",
        url: profileUrl,
      });
      onShared?.();
    } catch {
      // User cancelled the share sheet, or it failed — no error state
      // needed, they're still looking at the dialog with Copy Link handy.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} ariaLabel="Share profile">
      <DialogClose onClose={() => onOpenChange(false)} />
      <DialogHeader>
        <DialogTitle>
          Share {profileName ? `${profileName}'s` : "this"} profile
        </DialogTitle>
      </DialogHeader>

      <p className="break-all rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink">
        {profileUrl}
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="flex-1 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          {copied ? "Link copied!" : "Copy Link"}
        </button>
        {canNativeShare && (
          <button
            type="button"
            onClick={handleNativeShare}
            className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink transition hover:bg-surface"
          >
            Share
          </button>
        )}
      </div>
    </Dialog>
  );
}
