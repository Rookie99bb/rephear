"use client";

import { useState } from "react";

// Phase 5.5 (§16): the claimed owner's one-click "Thank my early
// backers". The server enforces claimed-gating and the once-per-
// milestone rate limit; the response carries only the aggregate count
// (private-safe by construction — no names ever reach this UI).
export default function ThankEarlyBackersButton({
  profileId,
}: {
  profileId: string;
}) {
  const [state, setState] = useState<
    "idle" | "sending" | "sent" | "already" | "error"
  >("idle");
  const [sentCount, setSentCount] = useState(0);

  async function onThank() {
    setState("sending");
    try {
      const res = await fetch(`/api/profiles/${profileId}/thank-backers`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        sent?: number;
        reason?: string;
      };
      if (res.ok && data.ok) {
        setSentCount(data.sent ?? 0);
        setState("sent");
      } else if (res.status === 429 || data.reason === "already_thanked") {
        setState("already");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <p className="text-sm font-medium text-ink">
        ❤️ Sent to {sentCount} early backer{sentCount === 1 ? "" : "s"} —
        they each got a private thank-you.
      </p>
    );
  }
  if (state === "already") {
    return (
      <p className="text-sm text-subtle">
        Already thanked for this milestone — a new milestone unlocks another
        thank-you.
      </p>
    );
  }
  return (
    <div>
      <button
        type="button"
        onClick={onThank}
        disabled={state === "sending"}
        className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {state === "sending" ? "Sending…" : "❤️ Thank my early backers"}
      </button>
      <p className="mt-2 max-w-md text-xs text-subtle">
        Sends a thank-you notification to your early backers. Each backer
        gets it privately — no names are ever shared, and you only ever see
        the total count.
      </p>
      {state === "error" && (
        <p className="mt-2 text-xs text-red-600">
          Something went wrong — please try again.
        </p>
      )}
    </div>
  );
}
