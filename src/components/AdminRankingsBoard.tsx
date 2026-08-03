"use client";

import { useState, useTransition, useRef } from "react";
import type { Ranking } from "@/lib/types";
import { setRankingHiddenAction } from "@/lib/actions/moderation";
import {
  setRankingPinnedAction,
  reorderRankingsAction,
} from "@/lib/actions/rankingAdmin";

interface CityGroup {
  city: string;
  country: string;
  rankings: Ranking[];
}

// Sort mirrors the public/admin query order: pinned first, then
// displayOrder ascending. Re-applied locally after a pin/unpin toggle so a
// card visibly jumps to the correct group without waiting on a full page
// reload — displayOrder itself is never touched by pinning.
function sortGroup(rankings: Ranking[]): Ranking[] {
  return [...rankings].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return a.displayOrder - b.displayOrder;
  });
}

let toastId = 0;

export default function AdminRankingsBoard({ groups }: { groups: CityGroup[] }) {
  const [groupState, setGroupState] = useState(
    groups.map((g) => ({ ...g, rankings: sortGroup(g.rankings) }))
  );
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);
  const [, startTransition] = useTransition();
  const dragCity = useRef<string | null>(null);
  const dragId = useRef<string | null>(null);

  function pushToast(message: string) {
    const id = ++toastId;
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3000);
  }

  function updateGroup(city: string, updater: (rankings: Ranking[]) => Ranking[]) {
    setGroupState((groupsState) =>
      groupsState.map((g) => (g.city === city ? { ...g, rankings: updater(g.rankings) } : g))
    );
  }

  function handleHideToggle(ranking: Ranking) {
    const next = !ranking.isHidden;
    updateGroup(ranking.city, (rankings) =>
      rankings.map((r) => (r.id === ranking.id ? { ...r, isHidden: next } : r))
    );
    startTransition(async () => {
      const result = await setRankingHiddenAction(ranking.id, next);
      if (result.error) {
        pushToast(result.error);
        updateGroup(ranking.city, (rankings) =>
          rankings.map((r) => (r.id === ranking.id ? { ...r, isHidden: !next } : r))
        );
        return;
      }
      pushToast(next ? "Ranking hidden." : "Ranking published.");
    });
  }

  function handlePinToggle(ranking: Ranking) {
    const next = !ranking.isPinned;
    updateGroup(ranking.city, (rankings) =>
      sortGroup(rankings.map((r) => (r.id === ranking.id ? { ...r, isPinned: next } : r)))
    );
    startTransition(async () => {
      const result = await setRankingPinnedAction(ranking.id, next);
      if (result.error) {
        pushToast(result.error);
        updateGroup(ranking.city, (rankings) =>
          sortGroup(rankings.map((r) => (r.id === ranking.id ? { ...r, isPinned: !next } : r)))
        );
        return;
      }
      pushToast(next ? "Ranking pinned." : "Ranking unpinned.");
    });
  }

  function handleDragStart(city: string, id: string) {
    dragCity.current = city;
    dragId.current = id;
  }

  function handleDrop(city: string, targetId: string) {
    // Guard: a card can only be dropped among cards from its own city —
    // each city renders its own <ul>, so a cross-city drop would require
    // dragging into a different container, but this check makes the
    // "never reorder another city" guarantee explicit rather than
    // incidental to the DOM layout.
    if (dragCity.current !== city || !dragId.current || dragId.current === targetId) {
      dragCity.current = null;
      dragId.current = null;
      return;
    }
    const draggedId = dragId.current;
    dragCity.current = null;
    dragId.current = null;

    let newOrderIds: string[] = [];
    updateGroup(city, (rankings) => {
      const fromIndex = rankings.findIndex((r) => r.id === draggedId);
      const toIndex = rankings.findIndex((r) => r.id === targetId);
      if (fromIndex === -1 || toIndex === -1) {
        newOrderIds = rankings.map((r) => r.id);
        return rankings;
      }
      const next = [...rankings];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      newOrderIds = next.map((r) => r.id);
      return next;
    });

    startTransition(async () => {
      const result = await reorderRankingsAction(city, newOrderIds);
      if (result.error) {
        pushToast(result.error);
        return;
      }
      pushToast("Ranking order updated.");
    });
  }

  return (
    <div className="space-y-8">
      {groupState.map((group) => (
        <div key={group.city}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
            {group.city}, {group.country}
          </h3>
          <ul className="space-y-2" onDragOver={(e) => e.preventDefault()}>
            {group.rankings.map((ranking, index) => (
              <li
                key={ranking.id}
                draggable
                onDragStart={() => handleDragStart(group.city, ranking.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(group.city, ranking.id)}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white p-3 text-sm"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="cursor-grab select-none pt-0.5 text-subtle"
                    title="Drag to reorder"
                  >
                    &#9776;
                  </span>
                  <div>
                    <p className="font-medium text-ink">{ranking.title}</p>
                    <p className="text-xs text-subtle">
                      {ranking.city}, {ranking.country}
                    </p>
                    <p className="text-xs text-subtle">Position: {index + 1}</p>
                    <p className="text-xs text-subtle">
                      Status: {ranking.isHidden ? "Hidden" : "Visible"}
                    </p>
                    <p className="text-xs text-subtle">
                      Pinned: {ranking.isPinned ? "Yes" : "No"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => handlePinToggle(ranking)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface"
                  >
                    {ranking.isPinned ? "Unpin" : "Pin"}
                  </button>
                  <button
                    onClick={() => handleHideToggle(ranking)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface"
                  >
                    {ranking.isHidden ? "Show" : "Hide"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto rounded-lg bg-ink px-4 py-2 text-xs font-medium text-white shadow-lg"
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
