"use client";

import { useState } from "react";
import type { CreditPackage } from "@/lib/creditPackages";

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

  async function handleSelect(packageId: string) {
    setLoadingId(packageId);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rankingId, profileId, packageId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || "Could not start checkout.");
        setLoadingId(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Could not start checkout.");
      setLoadingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {packages.map((pkg) => (
        <button
          key={pkg.id}
          disabled={loadingId !== null}
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
      <p className="text-xs text-subtle">
        Payments are processed securely by Stripe. Reputation Credits are
        credited automatically once payment is confirmed.
      </p>
    </div>
  );
}
