"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  reviewPayoutAction,
  type ReferrerAdminActionResult,
} from "@/lib/actions/referrerAdmin";

const initialState: ReferrerAdminActionResult = {};

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

// Review controls for one payout request. Mirrors the redemption review
// pattern: approve (requested -> approved), mark paid (approved -> paid,
// money already sent externally — this form never moves money itself),
// or reject with a reason.
export default function AdminPayoutReviewForm({
  payoutId,
  status,
  isSelf,
}: {
  payoutId: string;
  status: string;
  isSelf: boolean;
}) {
  const approveAction = reviewPayoutAction.bind(null, payoutId, "approve");
  const paidAction = reviewPayoutAction.bind(null, payoutId, "paid");
  const rejectAction = reviewPayoutAction.bind(null, payoutId, "reject");
  const [approveState, approveFormAction] = useFormState(approveAction, initialState);
  const [paidState, paidFormAction] = useFormState(paidAction, initialState);
  const [rejectState, rejectFormAction] = useFormState(rejectAction, initialState);

  if (isSelf) {
    return (
      <p className="text-xs font-medium text-amber-700">
        You cannot review your own payout request.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {status === "requested" && (
        <form action={approveFormAction} className="flex flex-col gap-2">
          <input
            name="adminNotes"
            placeholder="Reviewer note (optional)"
            className="rounded-lg border border-border px-2.5 py-2 text-xs outline-none focus:border-ink"
          />
          <ActionButton
            label="Approve"
            pendingLabel="Saving…"
            className="bg-ink text-white"
          />
          {approveState.error && (
            <p className="text-xs text-red-600">{approveState.error}</p>
          )}
        </form>
      )}
      {status === "approved" && (
        <form action={paidFormAction} className="flex flex-col gap-2">
          <input
            name="providerRef"
            placeholder="External transfer reference (required)"
            className="rounded-lg border border-border px-2.5 py-2 text-xs outline-none focus:border-ink"
          />
          <input
            name="adminNotes"
            placeholder="Reviewer note (optional)"
            className="rounded-lg border border-border px-2.5 py-2 text-xs outline-none focus:border-ink"
          />
          <ActionButton
            label="Mark Paid"
            pendingLabel="Saving…"
            className="bg-emerald-700 text-white"
          />
          {paidState.error && (
            <p className="text-xs text-red-600">{paidState.error}</p>
          )}
        </form>
      )}
      {(status === "requested" || status === "approved") && (
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
          {rejectState.error && (
            <p className="text-xs text-red-600">{rejectState.error}</p>
          )}
        </form>
      )}
    </div>
  );
}
