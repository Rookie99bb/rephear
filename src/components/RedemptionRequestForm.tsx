"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { requestRedemptionAction, type RedemptionActionResult } from "@/lib/actions/redemptions";
import { computeRedemptionAmounts, MIN_REDEMPTION_CREDITS, formatCents } from "@/lib/redemption";

const initialState: RedemptionActionResult = {};

export default function RedemptionRequestForm({
  profileId,
  available,
}: {
  profileId: string;
  available: number;
}) {
  const action = requestRedemptionAction.bind(null, profileId);
  const [state, formAction] = useFormState(action, initialState);
  const [credits, setCredits] = useState<string>("");

  const parsed = Number.parseInt(credits, 10);
  const preview =
    Number.isFinite(parsed) && parsed > 0 ? computeRedemptionAmounts(parsed) : null;

  if (state.success) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm font-medium text-emerald-800">
          Redemption request submitted.
        </p>
        <p className="mt-1 text-xs text-emerald-700">
          We&apos;ll review it and send your payout to the contact you provided.
          You can track its status below.
        </p>
      </div>
    );
  }

  if (available < MIN_REDEMPTION_CREDITS) {
    return (
      <p className="text-sm text-subtle">
        You have {available} Credit{available === 1 ? "" : "s"} available —
        redemptions start at {MIN_REDEMPTION_CREDITS} Credits (
        {formatCents(computeRedemptionAmounts(MIN_REDEMPTION_CREDITS).grossAmountCents)}
        ).
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-subtle">
          Credits to redeem (up to {available})
        </label>
        <input
          name="credits"
          type="number"
          min={MIN_REDEMPTION_CREDITS}
          max={available}
          step={1}
          required
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
          className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-ink"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-subtle">
          Payout contact (e.g. PayPal email)
        </label>
        <input
          name="payoutContact"
          type="text"
          required
          placeholder="you@example.com"
          className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-ink"
        />
      </div>

      {preview && (
        <div className="rounded-xl border border-border bg-surface p-3 text-sm">
          <Row label="Gross amount" value={formatCents(preview.grossAmountCents)} />
          <Row label="Platform service fee (20%)" value={`- ${formatCents(preview.feeCents)}`} />
          <div className="mt-1.5 border-t border-border pt-1.5">
            <Row label="You receive" value={formatCents(preview.netAmountCents)} bold />
          </div>
        </div>
      )}

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton />
      <p className="text-xs text-subtle">
        Payouts are reviewed and sent by RepHear staff, not automatically —
        this can take a few business days.
      </p>
    </form>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-semibold text-ink" : "text-subtle"}>{label}</span>
      <span className={bold ? "font-semibold text-ink" : "text-ink"}>{value}</span>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded-xl bg-ink px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Submitting…" : "Request Redemption"}
    </button>
  );
}
