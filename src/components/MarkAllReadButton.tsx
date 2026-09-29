"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Small client island for the notification center page.
export default function MarkAllReadButton() {
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function markAll() {
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } finally {
      setDone(true);
      router.refresh();
    }
  }

  if (done) return null;
  return (
    <button
      onClick={markAll}
      className="rounded-full border border-border px-4 py-1.5 text-sm font-medium hover:bg-black/[0.04]"
    >
      Mark all read
    </button>
  );
}
