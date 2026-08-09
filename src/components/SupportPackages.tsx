"use client";

import { useState } from "react";
import type { CreditPackage } from "@/lib/creditPackages";
import {
  CREDITS_PER_DOLLAR,
  CUSTOM_AMOUNT_MIN_DOLLARS,
  CUSTOM_AMOUNT_MAX_DOLLARS,
} from "@/lib/creditPackages";

export default function SupportPackages({
  rankingId,
  profileId,
  packages,
}: {
  rankingId: string;
  profileId: string;
  packages: CreditPackage[];
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  const busy = loadingId !== null || customLoading;

  async function startCheckout(body: Record<string, unknown>) {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rankingId, profileId, ...body }),
    });
    const data = await res.json();
    if (!res.ok || !data.url) {
      throw new Error(data.error || "Could not start checkout.");
    }
    window.location.href = data.url;
  }

  async function handleSelect(packageId: string) {
    setLoadingId(packageId);
    setError(null);
    try {
      await startCheckout({ packageId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.");
      setLoadingId(null);
    }
  }

  async function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCustomError(null);

    const dollars = Number(customAmount);
    if (
      !Number.isInteger(dollars) ||
      dollars < CUSTOM_AMOUNT_MIN_DOLLARS ||
      dollars > CUSTOM_AMOUNT_MAX_DOLLARS
    ) {
      setCustomError(
        `Enter a whole dollar amount between $${CUSTOM_AMOUNT_MIN_DOLLARS} and $${CUSTOM_AMOUNT_MAX_DOLLARS}.`
      );
      return;
    }

    setCustomLoading(true);
    try {
      await startCheckout({ customAmountDollars: dollars });
    } catch (err) {
      setCustomError(err instanceof Error ? err.message : "Could not start checkout.");
      setCustomLoading(false);
    }
  }

  // Live preview of the Credits a custom dollar amount would grant —
  // purely cosmetic, the server independently computes (and is the only
  // source of truth for) the real amount in api/checkout/route.ts.
  const customDollarsPreview = Number(customAmount);
  const showCustomPreview =
    customAmount.trim() !== "" &&
    Number.isInteger(customDollarsPreview) &&
    customDollarsPreview > 0;

  return (
    <div className="flex flex-col gap-3">
      {packages.map((pkg) => (
        <button
          key={pkg.id}
          disabled={busy}
          onClick={() => handleSelect(pkg.id)}
          className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-left transition hover:border-ink disabled:opacity-50"
        >
          <span className="text-sm font-medium text-ink">{pkg.label}</span>
          <span className="text-sm text-subtle">
            {loadingId === pkg.id
              ? "Redirecting…"
              : `$${(pkg.priceCents / 100).toFixed(2)}`}
          </span>
        </button>
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <form
        onSubmit={handleCustomSubmit}
        className="flex flex-col gap-2 rounded-xl border border-border px-4 py-3"
      >
        <label htmlFor="custom-amount" className="text-sm font-medium text-ink">
          Custom amount
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-subtle">$</span>
          <input
            id="custom-amount"
            type="number"
            inputMode="numeric"
            min={CUSTOM_AMOUNT_MIN_DOLLARS}
            max={CUSTOM_AMOUNT_MAX_DOLLARS}
            step={1}
            placeholder={`${CUSTOM_AMOUNT_MIN_DOLLARS}–${CUSTOM_AMOUNT_MAX_DOLLARS}`}
            value={customAmount}
            disabled={busy}
            onChange={(e) => setCustomAmount(e.target.value)}
            className="w-24 rounded-lg border border-border px-2 py-1.5 text-sm text-ink outline-none focus:border-ink disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy || customAmount.trim() === ""}
            className="ml-auto rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {customLoading ? "Redirecting…" : "Support"}
          </button>
        </div>
        {showCustomPreview && (
          <p className="text-xs text-subtle">
            = {(customDollarsPreview * CREDITS_PER_DOLLAR).toLocaleString()} Reputation Credits
          </p>
        )}
        {customError && <p className="text-sm text-red-600">{customError}</p>}
      </form>

      <p className="text-xs text-subtle">
        Payments are processed securely by Stripe. Reputation Credits are
        credited automatically once payment is confirmed.
      </p>
    </div>
  );
}
