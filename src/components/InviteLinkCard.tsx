"use client";

import { useState } from "react";

// Minimal invite-link surface for Settings (phase 1 of the invitation
// system). Deliberately small in scope — no QR code, share buttons, or
// Ambassador progress bar yet, those belong to the full /profile/invite
// dashboard planned for a later phase; this just makes the link
// something a user can actually find and copy today.
export default function InviteLinkCard({
  inviteUrl,
  totalVisits,
  successfulInvites,
  inviteBonusLikes,
}: {
  inviteUrl: string;
  totalVisits: number;
  successfulInvites: number;
  inviteBonusLikes: number;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail (permissions, insecure context, etc.) —
      // fail quietly, the link is still visible and selectable by hand.
    }
  }

  return (
    <div className="rounded-xl border border-border p-4">
      <p className="break-all text-sm font-medium text-ink">{inviteUrl}</p>
      <button
        type="button"
        onClick={handleCopy}
        className="mt-3 rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>

      <div className="mt-4 flex gap-6 text-xs text-subtle">
        <div>
          <span className="block text-base font-semibold text-ink">
            {successfulInvites}
          </span>
          People joined
        </div>
        <div>
          <span className="block text-base font-semibold text-ink">
            {totalVisits}
          </span>
          Link visits
        </div>
        <div>
          <span className="block text-base font-semibold text-ink">
            {inviteBonusLikes}
          </span>
          Bonus Likes earned
        </div>
      </div>
    </div>
  );
}
