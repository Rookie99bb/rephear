"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  founderOverrideClaimAction,
  type FounderOverrideResult,
} from "@/lib/actions/claimRequests";

const initialState: FounderOverrideResult = {};

// This is only ever rendered by /admin/claims for the narrow case the
// backend action (founderOverrideClaimAction) also independently
// re-verifies server-side: the viewer is the designated founder, there is
// exactly one administrator, and this is their own claim. See that
// action's own doc comment for the full list of server-side conditions —
// this component is a UI convenience, not a security boundary.
export default function FounderOverrideForm({ requestId }: { requestId: string }) {
  const [expanded, setExpanded] = useState(false);
  const action = founderOverrideClaimAction.bind(null, requestId);
  const [state, formAction] = useFormState(action, initialState);

  if (!expanded) {
    return (
      <div className="mt-3 border-t border-amber-200 pt-3">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="rounded-lg border border-red-700 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-700 hover:text-white"
        >
          Founder Override (self-approval exception)
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border-2 border-red-700 bg-red-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-red-800">
        ⚠ Self-Approval Exception
      </p>
      <p className="mt-1 text-xs text-red-900">
        You are the sole administrator, so no one else can review this claim. This
        override approves your own claim and transfers profile ownership to you. It is
        logged as a distinct, permanent audit event (Founder Claim Override) separate
        from a normal review, and stops working the moment a second administrator
        exists. Use only if this is genuinely your own identity.
      </p>
      <form action={formAction} className="mt-3 flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-xs text-red-900">
          <span className="font-medium">Written reason (required)</span>
          <textarea
            name="overrideReason"
            required
            rows={2}
            className="rounded-lg border border-red-300 px-2.5 py-2 text-xs outline-none focus:border-red-700"
            placeholder="Why this override is justified"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-red-900">
          <span className="font-medium">Re-enter your password to confirm</span>
          <input
            type="password"
            name="confirmPassword"
            required
            className="rounded-lg border border-red-300 px-2.5 py-2 text-xs outline-none focus:border-red-700"
          />
        </label>
        <div className="flex items-center gap-2">
          <SubmitButton />
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-subtle hover:text-ink"
          >
            Cancel
          </button>
        </div>
        {state.error && <p className="text-xs text-red-700">{state.error}</p>}
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded-lg bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Overriding…" : "Confirm Override & Approve"}
    </button>
  );
}
