"use client";

import { useState, useTransition, useRef } from "react";
import type { Ranking } from "@/lib/types";
import {
  setRankingHiddenAction,
  updateRankingTaxonomyAction,
} from "@/lib/actions/moderation";
import {
  setRankingPinnedAction,
  reorderRankingsAction,
} from "@/lib/actions/rankingAdmin";
import CoverControls from "./CoverControls";

interface CityGroup {
  city: string;
  country: string;
  rankings: Ranking[];
}

interface TaxonomyCategoryOption {
  id: string;
  name: string;
  slug: string;
  subcategories: { id: string; name: string; slug: string }[];
}

const SCOPE_OPTIONS = [
  { value: "global", label: "🌍 Global" },
  { value: "country", label: "📍 Country" },
  { value: "city", label: "📍 City (London)" },
] as const;

function scopeDisplayLabel(ranking: Ranking): string {
  if (ranking.scope === "global") return "🌍 Global";
  if (ranking.scope === "country") return `📍 ${ranking.country}`;
  return `📍 ${ranking.city}, ${ranking.country}`;
}

// Per-row taxonomy editor (Taxonomy v2): category / subcategory / scope /
// tags. Saves via updateRankingTaxonomyAction (admin-only, audited); never
// touches engagement, nominees, covers or location.
function TaxonomyEditor({
  ranking,
  taxonomyCategories,
  categoryNames,
  subcategoryNames,
  onToast,
  onRankingChange,
}: {
  ranking: Ranking;
  taxonomyCategories: TaxonomyCategoryOption[];
  categoryNames: Record<string, string>;
  subcategoryNames: Record<string, string>;
  onToast: (message: string) => void;
  onRankingChange: (next: Ranking) => void;
}) {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState(ranking.categoryId ?? "");
  const [subcategoryId, setSubcategoryId] = useState(
    ranking.subcategoryId ?? ""
  );
  const [scope, setScope] = useState<"global" | "country" | "city">(
    ranking.scope ?? (ranking.isGlobal ? "global" : "city")
  );
  const [tagsInput, setTagsInput] = useState(ranking.tags ?? "");
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  const activeCategory = taxonomyCategories.find((c) => c.id === categoryId);
  const subOptions = activeCategory ? activeCategory.subcategories : [];

  function handleCategoryChange(next: string) {
    setCategoryId(next);
    setSubcategoryId("");
  }

  function handleSave() {
    setSaving(true);
    startTransition(async () => {
      const result = await updateRankingTaxonomyAction(ranking.id, {
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null,
        scope,
        tags: tagsInput.split(","),
      });
      setSaving(false);
      if (result.error) {
        onToast(result.error);
        return;
      }
      onRankingChange({
        ...ranking,
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null,
        scope,
        isGlobal: scope === "global",
        tags: tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .join(", "),
      });
      onToast("Taxonomy updated.");
      setOpen(false);
    });
  }

  const currentCategoryName = ranking.categoryId
    ? (categoryNames[ranking.categoryId] ?? "—")
    : "—";
  const currentSubName = ranking.subcategoryId
    ? (subcategoryNames[ranking.subcategoryId] ?? "—")
    : "—";

  return (
    <div className="border-t border-border pt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs font-medium text-subtle hover:text-ink"
      >
        {open ? "▾" : "▸"} Taxonomy: {currentCategoryName}
        {ranking.subcategoryId ? ` / ${currentSubName}` : ""} ·{" "}
        {scopeDisplayLabel(ranking)}
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="text-xs text-subtle">
            Category
            <select
              value={categoryId}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-white px-2 py-1.5 text-sm text-ink"
            >
              <option value="">— None —</option>
              {taxonomyCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-subtle">
            Subcategory
            <select
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
              disabled={!activeCategory}
              className="mt-1 w-full rounded-lg border border-border bg-white px-2 py-1.5 text-sm text-ink disabled:opacity-50"
            >
              <option value="">— None —</option>
              {subOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-subtle">
            Scope
            <select
              value={scope}
              onChange={(e) =>
                setScope(e.target.value as "global" | "country" | "city")
              }
              className="mt-1 w-full rounded-lg border border-border bg-white px-2 py-1.5 text-sm text-ink"
            >
              {SCOPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-subtle">
            Tags (comma-separated)
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="anime, 2026, trending"
              className="mt-1 w-full rounded-lg border border-border bg-white px-2 py-1.5 text-sm text-ink"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save taxonomy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
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

export default function AdminRankingsBoard({
  groups,
  categorySlugs = {},
  categoryNames = {},
  subcategoryNames = {},
  taxonomyCategories = [],
}: {
  groups: CityGroup[];
  categorySlugs?: Record<string, string>;
  categoryNames?: Record<string, string>;
  subcategoryNames?: Record<string, string>;
  taxonomyCategories?: TaxonomyCategoryOption[];
}) {
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
                className="flex flex-col gap-3 rounded-xl border border-border bg-white p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
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
                        {scopeDisplayLabel(ranking)}
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
                </div>
                <div className="border-t border-border pt-3">
                  <CoverControls
                    ranking={ranking}
                    categorySlug={
                      ranking.categoryId ? categorySlugs[ranking.categoryId] : null
                    }
                    onToast={pushToast}
                    onRankingChange={(next) =>
                      updateGroup(ranking.city, (rankings) =>
                        rankings.map((r) => (r.id === ranking.id ? next : r))
                      )
                    }
                  />
                </div>
                <TaxonomyEditor
                  ranking={ranking}
                  taxonomyCategories={taxonomyCategories}
                  categoryNames={categoryNames}
                  subcategoryNames={subcategoryNames}
                  onToast={pushToast}
                  onRankingChange={(next) =>
                    updateGroup(ranking.city, (rankings) =>
                      rankings.map((r) => (r.id === ranking.id ? next : r))
                    )
                  }
                />
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
