"use client";

import { useState } from "react";

type EventPageShareButtonProps = {
  className?: string;
  compact?: boolean;
};

const eventPath = "/events/animecon-london-2026";

export default function EventPageShareButton({
  className = "",
  compact = false,
}: EventPageShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function shareEvent() {
    const url = `${window.location.origin}${eventPath}`;
    const shareData = {
      title: "AnimeCon London ’26 on RepHear",
      text: "Find your AnimeCon people on RepHear.",
      url,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }

  return (
    <button
      type="button"
      onClick={shareEvent}
      className={className}
      aria-label="Share AnimeCon London ’26"
    >
      <span aria-hidden>↗</span>
      {copied ? "Link copied ✓" : compact ? "Share" : "Share AnimeCon"}
    </button>
  );
}
