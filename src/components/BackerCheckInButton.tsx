"use client";

import { useState, useTransition } from "react";
import { checkInAction } from "@/lib/actions/communityGrowth";

export default function BackerCheckInButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="mt-auto pt-4">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => {
          const result = await checkInAction();
          setMessage(result.error ?? result.success ?? null);
        })}
        className="rounded-full bg-brand-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Checking in…" : "Check in"}
      </button>
      {message && <p className="mt-2 text-xs text-subtle" role="status">{message}</p>}
    </div>
  );
}
