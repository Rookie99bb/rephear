"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  reviewRedemptionAction,
  type RedemptionActionResult,
} from "@/lib/actions/redemptions";

const initialState: RedemptionActionResult = {};

export default function AdminRedemptionReviewForm({
  redemptionId,
  isSelf,
}: {
  redemptionId: string;
  isSelf: boolean;
}) {
  const paidAction = reviewRedemptionAction.bind(null, redemptionId, "paid");
  const rejectAction = reviewRedemptionAction.bind(null, redemptionId, "reject");
  const [paidState, paidFormAction] = useFormState(paidAction, initialState);
  const [rejectState, rejectFormAction] = useFormState(rejectAction, initialState);

  if (isSelf) {
    return (
      <p className="text-xs font-medium text-amber-700">
        You cannot review your own redemption request.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <form action={paidFormAction} className="flex flex-col gap-2">
        <input
          name="adminNotes"
          placeholder="Payout reference (optional)"
          className="rounded-lg border border-border px-2.5 py-2 text-xs outline-none focus:border-ink"
        />
        <ActionButton
          label="Mark Paid"
          pendingLabel="Saving…"
          className="bg-emerald-700 text-white"
        />
        {paidState.error && <p className="text-xs text-red-600">{paidState.error}</p>}
      </form>

      <form action={rejectFormAction} className="flex flex-col gap-2">
        <input
          name="adminNotes"
          placeholder="Reason for rejection"
          className="rounded-lg border border-border px-2.5 py-2 text-xs outline-none focus:border-ink"
        />
        <ActionButton
          label="Reject"
          pendingLabel="Saving…"
          className="border border-red-700 text-red-700 hover:bg-red-700 hover:text-white"
        />
        {rejectState.error && <p className="text-xs text-red-600">{rejectState.error}</p>}
      </form>
    </div>
  );
}

function ActionButton({
  label,
  pendingLabel,
  className,
}: {
  label: string;
  pendingLabel: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`self-start rounded-lg px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50 ${className}`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
