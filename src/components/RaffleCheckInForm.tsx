"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  checkInToRaffleAction,
  type RaffleActionResult,
} from "@/lib/actions/raffles";

export default function RaffleCheckInForm({ raffleId }: { raffleId: string }) {
  const action = checkInToRaffleAction.bind(null, raffleId);
  const [state, formAction] = useFormState(action, {} as RaffleActionResult);

  if (state.success) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
        <h2 className="text-lg font-semibold text-ink">Check-in complete ✦</h2>
        <p className="mt-2 text-sm text-subtle">
          You are officially entered into the Backer Ticket Draw.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="rounded-2xl border border-border bg-white p-5">
      <h2 className="text-lg font-semibold text-ink">Complete Draw Check-in</h2>
      <p className="mt-2 text-sm text-subtle">
        We will verify that you cast a valid vote for one of the final Top 3 Rankings.
      </p>
      <SubmitButton />
      {state.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-5 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
    >
      {pending ? "Checking eligibility…" : "Check in to enter →"}
    </button>
  );
}
