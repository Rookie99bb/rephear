"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  drawRaffleAction,
  cancelRaffleAction,
  type RaffleActionResult,
} from "@/lib/actions/raffles";

const initialState: RaffleActionResult = {};

export default function RaffleDrawForm({
  raffleId,
  status,
  hasEnded,
  entryCount,
}: {
  raffleId: string;
  status: string;
  hasEnded: boolean;
  entryCount: number;
}) {
  const drawAction = drawRaffleAction.bind(null, raffleId);
  const cancelAction = cancelRaffleAction.bind(null, raffleId);
  const [drawState, drawFormAction] = useFormState(drawAction, initialState);
  const [cancelState, cancelFormAction] = useFormState(
    cancelAction,
    initialState
  );

  if (status !== "active") {
    return (
      <p className="text-sm text-subtle">
        This draw is {status} — no further actions available.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <form action={drawFormAction}>
        <ActionButton
          label={
            hasEnded
              ? `Draw Winners (${entryCount} entries)`
              : "Draw Winners (available after end time)"
          }
          pendingLabel="Drawing…"
          disabled={!hasEnded || entryCount === 0}
          className="bg-ink text-white hover:opacity-90"
        />
        {drawState.error && (
          <p className="mt-1 text-xs text-red-600">{drawState.error}</p>
        )}
      </form>
      <form action={cancelFormAction}>
        <ActionButton
          label="Cancel Draw"
          pendingLabel="Cancelling…"
          className="border border-red-700 text-red-700 hover:bg-red-700 hover:text-white"
        />
        {cancelState.error && (
          <p className="mt-1 text-xs text-red-600">{cancelState.error}</p>
        )}
      </form>
      {!hasEnded && (
        <p className="text-xs text-subtle">
          The draw button unlocks once the end time passes — this prevents
          early or accidental draws.
        </p>
      )}
      {hasEnded && entryCount === 0 && (
        <p className="text-xs text-subtle">
          No entries yet — drawing is disabled until someone enters.
        </p>
      )}
    </div>
  );
}

function ActionButton({
  label,
  pendingLabel,
  disabled,
  className,
}: {
  label: string;
  pendingLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
