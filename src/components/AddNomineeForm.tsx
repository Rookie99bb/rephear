"use client";

import { useFormState, useFormStatus } from "react-dom";
import { addNomineeAction, type ActionResult } from "@/lib/actions/nominees";

const initialState: ActionResult = {};

// Nominating someone always creates a brand new Nominee scoped to this
// Ranking — there is no "search existing profiles" / reuse step. Just a
// name, an optional photo, and an optional short description.
export default function AddNomineeForm({ rankingId }: { rankingId: string }) {
  const actionWithRanking = addNomineeAction.bind(null, rankingId);
  const [state, formAction] = useFormState(actionWithRanking, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input
        name="name"
        placeholder="Nominee name"
        required
        className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-ink"
      />
      <input
        name="photoUrl"
        type="url"
        placeholder="Photo URL (optional)"
        className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-ink"
      />
      <textarea
        name="bio"
        placeholder="Short description (optional)"
        rows={2}
        className="rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-ink"
      />

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton />
    </form>
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
      {pending ? "Adding…" : "Add Nominee"}
    </button>
  );
}
