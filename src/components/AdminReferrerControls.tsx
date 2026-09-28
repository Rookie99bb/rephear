"use client";

import { useState, useTransition, useRef } from "react";
import {
  setReferrerStatusAction,
  addRiskFlagAction,
  resolveRiskFlagAction,
  type ReferrerAdminActionResult,
} from "@/lib/actions/referrerAdmin";
import { useFormState } from "react-dom";

const initialFlagState: ReferrerAdminActionResult = {};

// Pause / resume toggle for one referrer profile. Audited server-side.
export function AdminReferrerStatusToggle({
  userId,
  status,
}: {
  userId: string;
  status: "active" | "paused";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(status);

  function toggle() {
    const next = current === "active" ? "paused" : "active";
    const reason = window.prompt(
      next === "paused"
        ? "Reason for pausing this referrer:"
        : "Reason for resuming this referrer:",
      ""
    );
    if (reason === null) return;
    setError(null);
    startTransition(async () => {
      const result = await setReferrerStatusAction(userId, next, reason);
      if (result.error) setError(result.error);
      else setCurrent(next);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
          current === "active"
            ? "bg-emerald-100 text-emerald-800"
            : "bg-red-100 text-red-700"
        }`}
      >
        {current}
      </span>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-ink hover:bg-muted disabled:opacity-50"
      >
        {pending ? "Saving…" : current === "active" ? "Pause" : "Resume"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

// Add a risk flag to a referrer. Advisory only — flags gate automatic
// release/payout, a human must still review.
export function AdminAddRiskFlagForm({ userId }: { userId: string }) {
  const [state, formAction] = useFormState(addRiskFlagAction, initialFlagState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData: FormData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="userId" value={userId} />
      <input
        name="type"
        placeholder="Flag type (e.g. self_referral)"
        className="rounded-lg border border-border px-2.5 py-1.5 text-xs outline-none focus:border-ink"
      />
      <select
        name="severity"
        defaultValue="medium"
        className="rounded-lg border border-border px-2.5 py-1.5 text-xs outline-none focus:border-ink"
      >
        <option value="low">low</option>
        <option value="medium">medium</option>
        <option value="high">high</option>
      </select>
      <input
        name="evidenceRef"
        placeholder="Evidence ref (optional)"
        className="rounded-lg border border-border px-2.5 py-1.5 text-xs outline-none focus:border-ink"
      />
      <button
        type="submit"
        className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-muted"
      >
        Add flag
      </button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      {state.success && (
        <span className="text-xs font-medium text-emerald-700">Flag added.</span>
      )}
    </form>
  );
}

// Resolve one open risk flag (cleared = false alarm, confirmed = upheld).
export function AdminResolveFlagButton({
  flagId,
}: {
  flagId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function resolve(resolution: "cleared" | "confirmed") {
    setError(null);
    startTransition(async () => {
      const result = await resolveRiskFlagAction(flagId, resolution);
      if (result.error) setError(result.error);
      else setDone(true);
    });
  }

  if (done) {
    return (
      <span className="text-xs font-medium text-emerald-700">Resolved.</span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => resolve("cleared")}
        disabled={pending}
        className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-ink hover:bg-muted disabled:opacity-50"
      >
        Clear
      </button>
      <button
        type="button"
        onClick={() => resolve("confirmed")}
        disabled={pending}
        className="rounded-lg border border-red-700 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-700 hover:text-white disabled:opacity-50"
      >
        Confirm fraud
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
