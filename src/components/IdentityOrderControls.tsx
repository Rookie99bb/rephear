"use client";

// Phase 5.7: owner-only reorder arrows for identity badges. Moves the
// badge up/down within the current order and POSTs the full new order
// to /api/identity-awards/order (the server validates ownership and
// that every key belongs to the requester).

import { useState } from "react";
import type { IdentityKey } from "@/lib/identityConfig";

export default function IdentityOrderControls({
  order,
  identityKey,
}: {
  order: IdentityKey[];
  identityKey: IdentityKey;
}) {
  const [busy, setBusy] = useState(false);

  async function move(dir: -1 | 1) {
    const idx = order.indexOf(identityKey);
    const next = [...order];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setBusy(true);
    try {
      const res = await fetch("/api/identity-awards/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ order: next }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } finally {
      setBusy(false);
    }
  }

  const idx = order.indexOf(identityKey);
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        aria-label="Move identity up"
        disabled={busy || idx <= 0}
        onClick={() => move(-1)}
        className="rounded-full border border-white/10 px-2 py-1 text-xs text-subtle disabled:opacity-30"
      >
        ↑
      </button>
      <button
        type="button"
        aria-label="Move identity down"
        disabled={busy || idx >= order.length - 1}
        onClick={() => move(1)}
        className="rounded-full border border-white/10 px-2 py-1 text-xs text-subtle disabled:opacity-30"
      >
        ↓
      </button>
    </div>
  );
}
