"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  reviewClaimRequestAction,
  type ReviewResult,
} from "@/lib/actions/claimRequests";

const initialState: ReviewResult = {};

export default function AdminClaimReviewForm({
  requestId,
}: {
  requestId: string;
}) {
  const approveAction = reviewClaimRequestAction.bind(
    null,
    requestId,
    "approve"
  );
  const rejectAction = reviewClaimRequestAction.bind(
    null,
    requestId,
    "reject"
  );
  const [approveState, approveFormAction] = useFormState(
    approveAction,
    initialState
  );
  const [rejectState, rejectFormAction] = useFormState(
    rejectAction,
    initialState
  );

  return (
    <div className="mt-3 grid grid-cols-1 gap-3 border-t border-amber-200 pt-3 sm:grid-cols-2">
      <form action={approveFormAction} className="flex flex-col gap-2">
        <textarea
          name="adminComments"
          rows={2}
          placeholder="Comments (optional)"
          className="rounded-lg border border-border px-2.5 py-2 text-xs outline-none focus:border-ink"
        />
        <ApproveButton />
        {approveState.error && (
          <p className="text-xs text-red-600">{approveState.error}</p>
        )}
      </form>
      <form action={rejectFormAction} className="flex flex-col gap-2">
        <textarea
          name="adminComments"
          rows={2}
          placeholder="Reason for rejection (optional)"
          className="rounded-lg border border-border px-2.5 py-2 text-xs outline-none focus:border-ink"
        />
        <RejectButton />
        {rejectState.error && (
          <p className="text-xs text-red-600">{rejectState.error}</p>
        )}
      </form>
    </div>
  );
}

function ApproveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Approving…" : "Approve"}
    </button>
  );
}

function RejectButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded-lg border border-red-700 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-700 hover:text-white disabled:opacity-50"
    >
      {pending ? "Rejecting…" : "Reject"}
    </button>
  );
}
