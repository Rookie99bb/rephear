"use client";

import { useState, useTransition } from "react";
import { acceptTermsAction } from "@/lib/actions/referrer";

// Short-form Referrer Terms (v1). Copy discipline: no fixed-income
// promises, no "easy money" — commission depends on real, qualified,
// non-refunded Support only. Full legal review still required before
// public cash launch (PRD 上线前置条件); this copy is the product
// surface, not legal advice.
export const REFERRER_TERMS_COPY = [
  "You earn 5% of the total amount of each qualified Support made by someone who signed up through your invite link, within 180 days of their signup.",
  "Only completed, non-refunded Support counts. Refunded or disputed payments never earn commission, and commission already paid out on them is clawed back.",
  "New commission is held for 14 days after the payment completes, then becomes withdrawable.",
  "Minimum withdrawal is $25. Payouts are reviewed and sent manually once a month to the contact you provide.",
  "Self-referrals, fake accounts, incentivised or misleading promotion, and impersonating RepHear or a nominee will forfeit commission and may close your referrer account.",
  "When you promote your link, you must disclose that you may earn a commission.",
  "You are responsible for any tax on commission you receive.",
];

export default function AcceptTermsForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptTermsAction();
      if (result.error) setError(result.error);
      else setAccepted(true);
    });
  }

  if (accepted) {
    return (
      <p className="text-sm font-medium text-emerald-700">
        Terms accepted — you can now request withdrawals once you reach the
        minimum.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-sm font-semibold text-ink">
        Referrer Terms <span className="font-normal text-subtle">v1</span>
      </p>
      <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-xs leading-relaxed text-subtle">
        {REFERRER_TERMS_COPY.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleAccept}
        disabled={pending}
        className="mt-3 rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Saving…" : "I accept the Referrer Terms"}
      </button>
    </div>
  );
}
