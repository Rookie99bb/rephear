"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Dialog, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/Dialog";

type EventPageShareButtonProps = {
  className?: string;
  compact?: boolean;
};

const eventPath = "/events/animecon-london-2026";

export default function EventPageShareButton({
  className = "",
  compact = false,
}: EventPageShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState(eventPath);
  const [qrCode, setQrCode] = useState("");

  useEffect(() => {
    setShareUrl(`${window.location.origin}${eventPath}`);
  }, []);

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(shareUrl, {
      width: 320,
      margin: 2,
      color: { dark: "#21144f", light: "#ffffff" },
    }).then(setQrCode).catch(() => setQrCode(""));
  }, [open, shareUrl]);

  async function shareEvent() {
    const shareData = {
      title: "AnimeCon London ’26 on RepHear",
      text: "Find your AnimeCon people on RepHear.",
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // The URL remains visible in the dialog if clipboard access is denied.
    }
  }

  return <>
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={className}
      aria-label="Share AnimeCon London ’26"
    >
      <span aria-hidden>↗</span>
      {compact ? "Share" : "Share AnimeCon"}
    </button>
    <Dialog open={open} onOpenChange={setOpen} ariaLabel="Share AnimeCon London ’26">
      <DialogClose onClose={() => setOpen(false)} />
      <DialogHeader><DialogTitle>Share AnimeCon London ’26</DialogTitle></DialogHeader>
      <p className="text-sm text-subtle">Scan to open the AnimeCon community space.</p>
      <div className="mx-auto mt-4 flex aspect-square w-full max-w-64 items-center justify-center overflow-hidden rounded-2xl border border-violet-100 bg-white p-3">
        {qrCode ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={qrCode} alt={`QR code for ${shareUrl}`} className="h-full w-full" /> : <span className="text-sm text-subtle">Creating QR code…</span>}
      </div>
      <p className="mt-4 break-all rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-950">{shareUrl}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={copyLink} className="rounded-xl border border-violet-200 px-3 py-3 text-sm font-bold text-violet-800">{copied ? "Link copied ✓" : "Copy link"}</button>
        <button type="button" onClick={shareEvent} className="rounded-xl bg-violet-700 px-3 py-3 text-sm font-bold text-white">Share…</button>
      </div>
    </Dialog>
  </>;
}
