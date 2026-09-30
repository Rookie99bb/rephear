"use client";

import { useState, useTransition } from "react";
import { applyFandomSeedLikesAction } from "@/lib/actions/moderation";

export default function SeedLikesControl({
  alreadyApplied,
  eligibleRankings,
  eligibleNominees,
  projectedTotal,
}: {
  alreadyApplied: boolean;
  eligibleRankings: number;
  eligibleNominees: number;
  projectedTotal: number;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-subtle">
        Editorial seed likes
      </p>
      <p className="mt-1 text-sm text-ink">
        {alreadyApplied ? (
          <>fandom_launch_v1 already applied — re-running is a no-op.</>
        ) : (
          <>
            fandom_launch_v1 not applied yet. Would seed{" "}
            <strong>{eligibleNominees.toLocaleString()}</strong> nominees across{" "}
            <strong>{eligibleRankings}</strong> rankings with ≈
            <strong>{projectedTotal.toLocaleString()}</strong> seed likes
            (deterministic, attributed to team@rephear.com).
          </>
        )}
      </p>
      {result && <p className="mt-2 text-sm text-subtle">{result}</p>}
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await applyFandomSeedLikesAction();
            if (r.error) setResult(`Error: ${r.error}`);
            else if (r.skipped) setResult(`Skipped: ${r.reason}`);
            else
              setResult(
                `Applied: ${r.rankingsSeeded} rankings, ${r.nomineesSeeded} nominees, ${r.totalSeedLikes?.toLocaleString()} seed likes.`
              );
          })
        }
        className="mt-3 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Applying…" : alreadyApplied ? "Re-run (no-op)" : "Apply seed likes"}
      </button>
    </div>
  );
}
