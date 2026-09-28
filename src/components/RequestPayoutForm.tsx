"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  requestPayoutAction,
  type ReferrerActionResult,
} from "@/lib/actions/referrer";
import { formatCents } from "@/lib/redemption";

const initialState: ReferrerActionResult = {};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Submitting…" : "Request withdrawal"}
    </button>
  );
}

// Withdrawal request form. Only rendered when the user is eligible; the
// server action re-validates everything (balance, terms, risk flags).
export default function RequestPayoutForm({
  availableCents,
  minPayoutCents,
  eligible,
  ineligibleReason,
}: {
  availableCents: number;
  minPayoutCents: number;
  eligible: boolean;
  ineligibleReason: string | null;
}) {
  const [state, formAction] = useFormState(requestPayoutAction, initialState);

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-ink">Withdraw</p>
        <p className="text-xs text-subtle">
          Minimum {formatCents(minPayoutCents)}
        </p>
      </div>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">
        {formatCents(availableCents)}
        <span className="ml-2 align-middle text-xs font-normal text-subtle">
          available
        </span>
      </p>

      {!eligible ? (
        <p className="mt-2 text-xs leading-relaxed text-subtle">
          {ineligibleReason}
        </p>
      ) : (
        <form action={formAction} className="mt-3 flex flex-col gap-2">
          <input
            name="payoutContact"
            placeholder="Where should we send it? (e.g. a PayPal email)"
            className="rounded-lg border border-border px-2.5 py-2 text-xs outline-none focus:border-ink"
          />
          <div className="flex items-center gap-3">
            <SubmitButton disabled={false} />
            {state.error && (
              <p className="text-xs text-red-600">{state.error}</p>
            )}
            {state.success && (
              <p className="text-xs font-medium text-emerald-700">
                Request submitted — we review payouts monthly.
              </p>
            )}
          </div>
          <p className="text-xs leading-relaxed text-subtle">
            Requesting locks your full available balance into one payout.
            Payouts are sent manually once a month; this request itself
            doesn&apos;t move money.
          </p>
        </form>
      )}
    </div>
  );
}
