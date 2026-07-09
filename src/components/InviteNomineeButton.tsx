"use client";

import { useState } from "react";

export default function InviteNomineeButton({
  profileId,
}: {
  profileId: string;
}) {
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  function handleInvite() {
    const url = `${window.location.origin}/profiles/${profileId}`;
    setLink(url);
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-2 inline-block">
      <button
        onClick={handleInvite}
        className="rounded-lg border border-amber-900 px-3 py-1.5 text-xs font-medium text-amber-900 transition hover:bg-amber-900 hover:text-white"
      >
        {copied ? "Link copied!" : "Invite Nominee"}
      </button>
      {link && (
        <p className="mt-1 max-w-xs break-all text-[11px] text-amber-800">
          Share this link so they can claim their profile: {link}
        </p>
      )}
    </div>
  );
}
