"use client";

import { useState, useTransition } from "react";
import { governanceVoteAction } from "@/lib/actions/communityGrowth";

export default function GovernanceVoteButton({ seasonId, candidateId }: { seasonId: string; candidateId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div>
      <button type="button" disabled={pending} onClick={() => startTransition(async () => {
        const result = await governanceVoteAction(seasonId, candidateId);
        setMessage(result.error ?? result.success ?? null);
      })} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Recording…" : "Vote"}
      </button>
      {message && <p className="mt-2 max-w-xs text-xs text-subtle" role="status">{message}</p>}
    </div>
  );
}
