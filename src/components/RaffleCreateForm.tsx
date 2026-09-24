"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  createRaffleAction,
  type RaffleActionResult,
} from "@/lib/actions/raffles";

const initialState: RaffleActionResult = {};

// Default end time: 14 days from now, formatted for datetime-local.
function defaultEndsAt(): string {
  const d = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
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
          placeholder="e.g. Vote for London's Best Underground DJ — Win £50"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-ink">
          Scope — leave empty for a site-wide draw
        </span>
        <select name="rankingId" className={inputClass} defaultValue="">
          <option value="">Site-wide (every Ranking feeds entries)</option>
          {rankings.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title} — {r.city}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-ink">Prize *</span>
        <input
          name="prizeDescription"
          required
          placeholder="e.g. £50 Rough Trade voucher"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-ink">
          Sponsor (optional — local business footing the prize)
        </span>
        <input
          name="sponsorName"
          placeholder="e.g. Brew & Bean, Shoreditch"
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

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink">Ends at *</span>
          <input
            name="endsAt"
            type="datetime-local"
            required
            defaultValue={defaultEndsAt()}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink">Winners *</span>
          <input
            name="winnerCount"
            type="number"
            min={1}
            max={100}
            defaultValue={1}
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
