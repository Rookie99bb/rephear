"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  softDeleteRankingAction,
  restoreRankingAction,
  setRankingHiddenAction,
  softDeleteNomineeAction,
  restoreNomineeAction,
} from "@/lib/actions/moderation";
import type { Ranking, Profile } from "@/lib/types";

export default function ModerationRankingRow({
  ranking,
  nominees,
}: {
  ranking: Ranking;
  nominees: Profile[];
}) {
  const [pending, startTransition] = useTransition();
  const [hidden, setHidden] = useState(ranking.isHidden);
  const [deleted, setDeleted] = useState(!!ranking.deletedAt);
  const [nomineeState, setNomineeState] = useState(
    nominees.map((n) => ({ ...n, deleted: !!n.deletedAt }))
  );

  return (
    <li className="rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link
            href={`/rankings/${ranking.id}`}
            className="text-sm font-medium text-ink hover:underline"
          >
            {ranking.title}
          </Link>
          <p className="text-xs text-subtle">
            {ranking.city}, {ranking.country}
            {hidden && (
              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
                Hidden (spam)
              </span>
            )}
            {deleted && (
              <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-red-800">
                Deleted
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={pending || deleted}
            onClick={() => {
              const next = !hidden;
              setHidden(next);
              startTransition(async () => {
                await setRankingHiddenAction(ranking.id, next);
              });
            }}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface disabled:opacity-50"
          >
            {hidden ? "Unhide" : "Hide as spam"}
          </button>
          {deleted ? (
            <button
              disabled={pending}
              onClick={() => {
                setDeleted(false);
                startTransition(async () => {
                  await restoreRankingAction(ranking.id);
                });
              }}
              className="rounded-lg border border-emerald-700 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-700 hover:text-white disabled:opacity-50"
            >
              Restore Ranking
            </button>
          ) : (
            <button
              disabled={pending}
              onClick={() => {
                if (
                  !confirm(
                    `Soft-delete "${ranking.title}"? It will be hidden from everyone but can be restored later — nothing is permanently removed.`
                  )
                )
                  return;
                setDeleted(true);
                startTransition(async () => {
                  await softDeleteRankingAction(ranking.id);
                });
              }}
              className="rounded-lg border border-red-700 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-700 hover:text-white disabled:opacity-50"
            >
              Delete Ranking
            </button>
          )}
        </div>
      </div>

      {nomineeState.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
          {nomineeState.map((nominee) => (
            <li
              key={nominee.id}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                nominee.deleted ? "border-red-200 bg-red-50" : "border-border"
              }`}
            >
              <span className="text-ink">{nominee.name}</span>
              {nominee.deleted ? (
                <button
                  disabled={pending}
                  onClick={() => {
                    setNomineeState((rows) =>
                      rows.map((r) =>
                        r.id === nominee.id ? { ...r, deleted: false } : r
                      )
                    );
                    startTransition(async () => {
                      await restoreNomineeAction(ranking.id, nominee.id);
                    });
                  }}
                  className="text-emerald-700 hover:underline"
                >
                  Restore
                </button>
              ) : (
                <button
                  disabled={pending}
                  onClick={() => {
                    if (
                      !confirm(
                        `Remove ${nominee.name} from this Ranking? This can be restored later.`
                      )
                    )
                      return;
                    setNomineeState((rows) =>
                      rows.map((r) =>
                        r.id === nominee.id ? { ...r, deleted: true } : r
                      )
                    );
                    startTransition(async () => {
                      await softDeleteNomineeAction(ranking.id, nominee.id);
                    });
                  }}
                  className="text-red-700 hover:underline"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
