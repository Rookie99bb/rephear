"use client";

import { useState } from "react";

// Share toolkit for the Referral Hub: copy link, QR code, and one-tap
// share targets. Copy discipline: the prefilled text never promises
// income — it sells the community, not the commission.
export default function ReferrerShareTools({
  inviteUrl,
  qrDataUrl,
}: {
  inviteUrl: string;
  qrDataUrl: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can fail (permissions, insecure context) — the link
      // stays visible and selectable by hand.
    }
  }

  async function handleNativeShare() {
    try {
      await navigator.share({
        title: "RepHear",
        text: "Join me on RepHear — recognition belongs to everyone.",
        url: inviteUrl,
      });
    } catch {
      // User dismissed the share sheet — nothing to do.
    }
  }

  const shareText = encodeURIComponent(
    "Join me on RepHear — recognition belongs to everyone."
  );
  const shareUrl = encodeURIComponent(inviteUrl);
  const canNativeShare =
    typeof navigator !== "undefined" && "share" in navigator;

  const targets = [
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`,
    },
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${shareText}%20${shareUrl}`,
    },
    {
      label: "Telegram",
      href: `https://t.me/share/url?url=${shareUrl}&text=${shareText}`,
    },
  ];

  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-sm font-semibold text-ink">Your invite link</p>
      <p className="mt-1 break-all text-sm text-subtle">{inviteUrl}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
        {targets.map((t) => (
          <a
            key={t.label}
            href={t.href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-muted"
          >
            Share on {t.label}
          </a>
        ))}
        {canNativeShare && (
          <button
            type="button"
            onClick={handleNativeShare}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-muted"
          >
            More…
          </button>
        )}
      </div>
      {qrDataUrl && (
        <div className="mt-4 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt="QR code for your invite link"
            width={120}
            height={120}
            className="rounded-lg border border-border"
          />
          <p className="text-xs leading-relaxed text-subtle">
            Point a phone camera at the code to open your invite link.
            Handy for flyers, stickers, and in-person meetups.
          </p>
        </div>
      )}
    </div>
  );
}
