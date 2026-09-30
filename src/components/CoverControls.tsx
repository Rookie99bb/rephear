"use client";

import { useRef, useState, useTransition } from "react";
import type { Ranking } from "@/lib/types";
import {
  setManualCoverAction,
  setCoverLockedAction,
  refreshCoverNowAction,
  restoreCategoryFallbackAction,
  setRankingGlobalAction,
} from "@/lib/actions/rankingCovers";
import { getCategoryFallbackCard } from "@/services/ranking-images/categoryFallbacks";

// Per-ranking cover controls for the admin rankings board:
// preview, upload/replace, lock, refresh-now, restore fallback,
// and the Global location toggle.
export default function CoverControls({
  ranking,
  categorySlug,
  onToast,
  onRankingChange,
}: {
  ranking: Ranking;
  categorySlug?: string | null;
  onToast: (message: string) => void;
  onRankingChange: (next: Ranking) => void;
}) {
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const locked = ranking.coverImageStatus === "manual";
  const preview =
    ranking.coverImageUrl?.trim() ||
    getCategoryFallbackCard(categorySlug ?? undefined);

  function run(label: string, fn: () => Promise<{ error?: string }>, apply?: (r: Ranking) => Ranking) {
    setBusy(true);
    startTransition(async () => {
      const result = await fn();
      setBusy(false);
      if (result.error) {
        onToast(result.error);
        return;
      }
      if (apply) onRankingChange(apply(ranking));
      onToast(label);
    });
  }

  function handleLockToggle() {
    const next = !locked;
    run(
      next ? "Cover locked — weekly refresh will skip it." : "Cover unlocked — back on automatic refresh.",
      () => setCoverLockedAction(ranking.id, next),
      (r) => ({ ...r, coverImageStatus: next ? ("manual" as const) : ("pending" as const) })
    );
  }

  function handleRefreshNow() {
    run("Cover refresh requested.", () => refreshCoverNowAction(ranking.id));
  }

  function handleRestoreFallback() {
    const url = getCategoryFallbackCard(categorySlug ?? undefined);
    run(
      "Category fallback restored.",
      () => restoreCategoryFallbackAction(ranking.id),
      (r) => ({
        ...r,
        coverImageUrl: url,
        coverImageSource: "category-fallback",
        coverImageStatus: "active" as const,
      })
    );
  }

  function handleGlobalToggle() {
    const next = !ranking.isGlobal;
    run(
      next ? "Marked as Global." : "Marked as local.",
      () => setRankingGlobalAction(ranking.id, next),
      (r) => ({ ...r, isGlobal: next })
    );
  }

  async function handleFilePicked(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload/photo", { method: "POST", body: form });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        onToast(data.error || "Upload failed.");
        return;
      }
      startTransition(async () => {
        const result = await setManualCoverAction(ranking.id, data.url!);
        setBusy(false);
        if (result.error) {
          onToast(result.error);
          return;
        }
        onRankingChange({
          ...ranking,
          coverImageUrl: data.url!,
          coverImageSource: "manual",
          coverImageStatus: "manual",
        });
        onToast("Cover uploaded and locked.");
      });
    } catch {
      setBusy(false);
      onToast("Upload failed — please try again.");
    }
  }

  const btn =
    "rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-ink hover:bg-surface disabled:opacity-50";

  return (
    <div className="flex items-center gap-3">
      <img
        src={preview}
        alt=""
        className="h-12 w-[72px] shrink-0 rounded-lg border border-border object-cover"
        loading="lazy"
      />
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-[11px] text-subtle">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
              locked ? "bg-amber-100 text-amber-800" : "bg-[#f1ecfd] text-[#6d28d9]"
            }`}
          >
            {locked ? "🔒 Locked" : "🔄 Auto"}
          </span>
          <span>{ranking.isGlobal ? "🌍 Global" : "📍 Local"}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button className={btn} disabled={busy} onClick={() => fileRef.current?.click()}>
            Upload
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void handleFilePicked(f);
            }}
          />
          <button className={btn} disabled={busy} onClick={handleLockToggle}>
            {locked ? "Unlock" : "Lock"}
          </button>
          <button className={btn} disabled={busy || locked} onClick={handleRefreshNow} title={locked ? "Unlock first" : "Run automatic refresh now"}>
            Refresh
          </button>
          <button className={btn} disabled={busy} onClick={handleRestoreFallback}>
            Fallback
          </button>
          <button className={btn} disabled={busy} onClick={handleGlobalToggle} title="Toggle Global vs local location label">
            {ranking.isGlobal ? "→ Local" : "→ Global"}
          </button>
        </div>
      </div>
    </div>
  );
}
