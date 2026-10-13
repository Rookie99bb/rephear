"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  createRaffleAction,
  type RaffleActionResult,
} from "@/lib/actions/raffles";

const initialState: RaffleActionResult = {};

function dateTimeLocal(days: number, hour: number, minute = 0): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  d.setHours(hour, minute, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function RaffleCreateForm({
  rankings,
}: {
  rankings: { id: string; title: string; city: string }[];
}) {
  const router = useRouter();
  const [state, formAction] = useFormState(createRaffleAction, initialState);

  useEffect(() => {
    if (state.success && state.raffleId) {
      router.push(`/admin/raffles/${state.raffleId}`);
    }
  }, [state, router]);

  const inputClass =
    "w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-ink";

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-ink">Draw title *</span>
        <input
          name="title"
          required
          placeholder="e.g. Vote for London's Best Underground DJ — Win a plush toy"
          className={inputClass}
        />
      </label>

      <fieldset className="rounded-xl border border-border p-4">
        <legend className="px-1 text-xs font-medium text-ink">
          Campaign Rankings (select all participating Rankings)
        </legend>
        <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
          {rankings.map((r) => (
            <label key={r.id} className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="rankingIds" value={r.id} className="mt-1" />
              <span>{r.title} — {r.city}</span>
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs text-subtle">
          Results are frozen 24 hours before the draw. Only voters in the final Top 3 qualify, and they must still complete Draw Check-in.
        </p>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-ink">Prize *</span>
        <input
          name="prizeDescription"
          required
          placeholder="e.g. Limited-edition RepHear plush toy × 3"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-ink">
          Sponsor (optional — leave empty when RepHear provides the prize itself)
        </span>
        <input
          name="sponsorName"
          placeholder="e.g. RepHear"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-ink">Description</span>
        <textarea
          name="description"
          rows={3}
          placeholder="How the draw works, when winners are announced…"
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink">Voting closes / Check-in opens *</span>
          <input name="startsAt" type="datetime-local" required defaultValue={dateTimeLocal(12, 20)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink">Check-in closes *</span>
          <input
            name="endsAt"
            type="datetime-local"
            required
            defaultValue={dateTimeLocal(13, 19, 30)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink">Draw starts *</span>
          <input name="drawAt" type="datetime-local" required defaultValue={dateTimeLocal(13, 20)} className={inputClass} />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink">Winners *</span>
          <input
            name="winnerCount"
            type="number"
            min={1}
            max={100}
          defaultValue={5}
            required
            className={inputClass}
          />
        </label>
      </div>

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
      className="w-fit rounded-lg bg-ink px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Creating…" : "Create Draw"}
    </button>
  );
}
