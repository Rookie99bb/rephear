"use client";

import { useState } from "react";
import type { CreditPackage } from "@/lib/creditPackages";
import {
  CREDITS_PER_DOLLAR,
  CREDITS_PER_POUND,
  CUSTOM_AMOUNT_MIN_UNITS,
  CUSTOM_AMOUNT_MAX_UNITS,
  currencySymbol,
  type SupportCurrency,
} from "@/lib/creditPackages";
import {
  SUPPORT_REASON_PRESETS,
  SUPPORT_REASON_CUSTOM,
  SUPPORT_REASON_TEXT_MAX,
} from "@/lib/supportReasons";
import type { Visibility } from "@/lib/types";

const CURRENCIES: SupportCurrency[] = ["usd", "gbp"];

export default function SupportPackages({
  rankingId,
  profileId,
  profileName,
  packages,
  defaultVisibility,
}: {
  rankingId: string;
  profileId: string;
  profileName: string;
  packages: CreditPackage[];
  defaultVisibility: Visibility;
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<SupportCurrency>("usd");
  const [showPublic, setShowPublic] = useState(defaultVisibility === "public");
  // Phase 5.1: optional "Why are you backing them?" — never blocks
  // checkout. null = skipped. Selecting the ✍️ chip reveals free text.
  const [reasonKey, setReasonKey] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState("");

  const busy = loadingId !== null || customLoading;
  const symbol = currencySymbol(currency);
  const perUnit = currency === "gbp" ? CREDITS_PER_POUND : CREDITS_PER_DOLLAR;

  async function startCheckout(body: Record<string, unknown>) {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rankingId,
        profileId,
        currency,
        visibilityChoice: (showPublic ? "public" : "private") as Visibility,
        // Phase 5.1 reason: preset key or "custom" + free text; nulls
        // when skipped. Server validates the key and trims/caps text.
        supportReason: reasonKey,
        supportReasonText:
          reasonKey === SUPPORT_REASON_CUSTOM ? reasonText : null,
        ...body,
      }),
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

    const units = Number(customAmount);
    if (
      !Number.isInteger(units) ||
      units < CUSTOM_AMOUNT_MIN_UNITS ||
      units > CUSTOM_AMOUNT_MAX_UNITS
    ) {
      setCustomError(
        `Enter a whole amount between ${symbol}${CUSTOM_AMOUNT_MIN_UNITS} and ${symbol}${CUSTOM_AMOUNT_MAX_UNITS}.`
      );
      return;
    }

    setCustomLoading(true);
    try {
      await startCheckout({ customAmount: units });
    } catch (err) {
      setCustomError(err instanceof Error ? err.message : "Could not start checkout.");
      setCustomLoading(false);
    }
  }

  // Live preview of the Credits a custom amount would grant — purely
  // cosmetic, the server independently computes (and is the only source
  // of truth for) the real amount in api/checkout/route.ts.
  const customUnitsPreview = Number(customAmount);
  const showCustomPreview =
    customAmount.trim() !== "" &&
    Number.isInteger(customUnitsPreview) &&
    customUnitsPreview > 0;

  // Fixed packages are defined by credit grant; the price in the chosen
  // currency follows the same unit rate (£1 = 10 credits, like $1 = 10).
  function packagePrice(pkg: CreditPackage): string {
    const minor = currency === "usd" ? pkg.priceCents : pkg.credits * 10;
    return `${symbol}${(minor / 100).toFixed(2)}`;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Like vs Backing, stated plainly (§1, §14). Backing is a
          PAID action — the copy must never let it read as free. This is
          the checkout surface, so money stays unambiguous. */}
      <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm leading-relaxed">
        <p className="text-ink">
          <span className="font-semibold">👍 Like</span>
          <span className="text-subtle"> says “I recognise you.” — free.</span>
        </p>
        <p className="mt-1 text-ink">
          <span className="font-semibold">❤️ Backing</span>
          <span className="text-subtle">
            {" "}
            says “I choose to stand behind you.” — a paid action. Your
            payment buys Reputation Credits for {profileName}, counted
            toward Most Supported.
          </span>
        </p>
      </div>

      {/* Phase 5.1: optional "Why are you backing them?" — skippable,
          never blocks checkout. The answer becomes part of the supporter's
          backing story (identity data over time, never an instant badge). */}
      <div className="rounded-xl border border-border px-4 py-3">
        <p className="text-sm font-medium text-ink">
          Why are you backing {profileName}?
          <span className="ml-1.5 text-xs font-normal text-subtle">(optional)</span>
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            Object.entries(SUPPORT_REASON_PRESETS) as [string, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              disabled={busy}
              onClick={() => setReasonKey(reasonKey === key ? null : key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                reasonKey === key
                  ? "border-ink bg-ink text-white"
                  : "border-border text-subtle hover:border-ink hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            key={SUPPORT_REASON_CUSTOM}
            type="button"
            disabled={busy}
            onClick={() =>
              setReasonKey(
                reasonKey === SUPPORT_REASON_CUSTOM ? null : SUPPORT_REASON_CUSTOM
              )
            }
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
              reasonKey === SUPPORT_REASON_CUSTOM
                ? "border-ink bg-ink text-white"
                : "border-border text-subtle hover:border-ink hover:text-ink"
            }`}
          >
            ✍️ Say it in your own words
          </button>
        </div>
        {reasonKey === SUPPORT_REASON_CUSTOM && (
          <textarea
            value={reasonText}
            disabled={busy}
            maxLength={SUPPORT_REASON_TEXT_MAX}
            rows={2}
            placeholder="What made you believe in them?"
            onChange={(e) => setReasonText(e.target.value)}
            className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-ink disabled:opacity-50"
          />
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-subtle">Currency</span>
        <div className="flex rounded-lg border border-border p-0.5">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              disabled={busy}
              onClick={() => setCurrency(c)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition disabled:opacity-50 ${
                currency === c
                  ? "bg-ink text-white"
                  : "text-subtle hover:text-ink"
              }`}
            >
              {c === "usd" ? "USD $" : "GBP £"}
            </button>
          ))}
        </div>
      </div>

      {packages.map((pkg) => (
        <button
          key={pkg.id}
          disabled={busy}
          onClick={() => handleSelect(pkg.id)}
          className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-left transition hover:border-ink disabled:opacity-50"
        >
          <span className="text-sm font-medium text-ink">{pkg.label}</span>
          <span className="text-sm text-subtle">
            {loadingId === pkg.id ? "Redirecting…" : packagePrice(pkg)}
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
          <span className="text-sm text-subtle">{symbol}</span>
          <input
            id="custom-amount"
            type="number"
            inputMode="numeric"
            min={CUSTOM_AMOUNT_MIN_UNITS}
            max={CUSTOM_AMOUNT_MAX_UNITS}
            step={1}
            placeholder={`${CUSTOM_AMOUNT_MIN_UNITS}–${CUSTOM_AMOUNT_MAX_UNITS}`}
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
            {customLoading ? "Redirecting…" : "Back them"}
          </button>
        </div>
        {showCustomPreview && (
          <p className="text-xs text-subtle">
            = {(customUnitsPreview * perUnit).toLocaleString()} Reputation Credits
          </p>
        )}
        {customError && <p className="text-sm text-red-600">{customError}</p>}
      </form>

      {/* Visibility choice (§9, §14). Private is control, not status:
          a private Support counts exactly the same toward the ranking. */}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border px-4 py-3">
        <input
          type="checkbox"
          checked={showPublic}
          disabled={busy}
          onChange={(e) => setShowPublic(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-pink-600"
        />
        <span className="text-sm">
          <span className="font-medium text-ink">
            Show that I back {profileName} on my profile
          </span>
          <span className="block text-xs text-subtle">
            {showPublic
              ? "This Support may appear as part of your public RepHear identity."
              : "🔒 Kept private — it still counts fully toward Most Supported, but stays in your history only."}{" "}
            You can change this anytime in Settings → Privacy.
          </span>
        </span>
      </label>

      <p className="text-xs text-subtle">
        Payments are processed securely by Stripe. Reputation Credits are
        credited automatically once payment is confirmed.
      </p>
    </div>
  );
}
