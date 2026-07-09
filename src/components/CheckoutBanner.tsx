"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

export default function CheckoutBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);

  const support = searchParams.get("support");
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    if (support === "cancelled" && sessionId) {
      fetch("/api/checkout/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
    }
  }, [support, sessionId]);

  if (!support || dismissed) return null;

  function close() {
    setDismissed(true);
    router.replace(pathname);
  }

  if (support === "success") {
    return (
      <div className="mb-6 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <span>
          Thank you for your support! Your Reputation Credits will appear
          shortly once payment is confirmed.
        </span>
        <button onClick={close} className="text-emerald-700 underline">
          Dismiss
        </button>
      </div>
    );
  }

  if (support === "cancelled") {
    return (
      <div className="mb-6 flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm text-subtle">
        <span>Checkout was cancelled. No payment was made.</span>
        <button onClick={close} className="text-ink underline">
          Dismiss
        </button>
      </div>
    );
  }

  return null;
}
