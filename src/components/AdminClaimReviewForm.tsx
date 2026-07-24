"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  reviewClaimRequestAction,
  requestMoreInfoAction,
  type ReviewResult,
} from "@/lib/actions/claimRequests";

const initialState: ReviewResult = {};

const INFO_ITEMS = [
  "Official email verification",
  "Official social media verification",
  "Official website",
  "Additional proof of representation",
  "Additional explanation",
];

export default function AdminClaimReviewForm({
  requestId,
}: {
  requestId: string;
}) {
  const [showMoreInfoForm, setShowMoreInfoForm] = useState(false);

  const approveAction = reviewClaimRequestAction.bind(null, requestId, "approve");
  const rejectAction = reviewClaimRequestAction.bind(null, requestId, "reject");
  const moreInfoAction = requestMoreInfoAction.bind(null, requestId);

  const [approveState, approveFormAction] = useFormState(approveAction, initialState);
  const [rejectState, rejectFormAction] = useFormState(rejectAction, initialState);
  const [moreInfoState, moreInfoFormAction] = useFormState(moreInfoAction, initialState);

  return (
    <div className="mt-3 border-t border-amber-200 pt-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <form action={approveFormAction} className="flex flex-col gap-2">
          <textarea
            name="adminComments"
            rows={2}
            placeholder="Comments (optional)"
            className="rounded-lg border border-border px-2.5 py-2 text-xs outline-none focus:border-ink"
          />
          <ActionButton
            label="Approve"
            pendingLabel="Approving…"
            className="bg-emerald-700 text-white"
          />
          {approveState.error && (
            <p className="text-xs text-red-600">{approveState.error}</p>
          )}
        </form>

        <div className="flex flex-col gap-2">
          {!showMoreInfoForm ? (
            <button
              type="button"
              onClick={() => setShowMoreInfoForm(true)}
              className="self-start rounded-lg border border-amber-700 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-700 hover:text-white"
            >
              Request More Information
            </button>
          ) : (
            <form action={moreInfoFormAction} className="flex flex-col gap-1.5">
              {INFO_ITEMS.map((item) => (
                <label key={item} className="flex items-center gap-1.5 text-xs text-amber-900">
                  <input type="checkbox" name="infoItems" value={item} />
                  {item}
                </label>
              ))}
              <input
                name="otherNote"
                placeholder="Other (optional)"
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs outline-none focus:border-ink"
              />
              <ActionButton
                label="Send Request"
                pendingLabel="Sending…"
                className="border border-amber-700 text-amber-900 hover:bg-amber-700 hover:text-white"
              />
              {moreInfoState.error && (
                <p className="text-xs text-red-600">{moreInfoState.error}</p>
              )}
            </form>
          )}
        </div>

        <form action={rejectFormAction} className="flex flex-col gap-2">
          <textarea
            name="adminComments"
            rows={2}
            placeholder="Reason for rejection (optional)"
            className="rounded-lg border border-border px-2.5 py-2 text-xs outline-none focus:border-ink"
          />
          <ActionButton
            label="Reject"
            pendingLabel="Rejecting…"
            className="border border-red-700 text-red-700 hover:bg-red-700 hover:text-white"
          />
          {rejectState.error && (
            <p className="text-xs text-red-600">{rejectState.error}</p>
          )}
        </form>
      </div>
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
