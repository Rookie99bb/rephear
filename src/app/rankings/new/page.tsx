"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createRankingAction, type ActionResult } from "@/lib/actions/rankings";

const initialState: ActionResult = {};

export default function NewRankingPage() {
  const [state, formAction] = useFormState(createRankingAction, initialState);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-xl font-semibold tracking-tight text-ink">
        Create a Ranking
      </h1>
      <p className="mb-6 text-sm text-subtle">
        One Ranking, one topic. For example &ldquo;London&apos;s Most Popular
        People&rdquo; or &ldquo;Best AI Founders in London&rdquo;.
      </p>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Title</span>
          <input
            name="title"
            required
            placeholder="Best AI Founders in London"
            className="rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-ink"
          />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">Country</span>
            <input
              name="country"
              required
              placeholder="United Kingdom"
              className="rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-ink"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">City</span>
            <input
              name="city"
              required
              placeholder="London"
              className="rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-ink"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Description</span>
          <textarea
            name="description"
            rows={3}
            placeholder="What is this Ranking about?"
            className="rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-ink"
          />
        </label>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <SubmitButton />
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
      className="mt-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Creating…" : "Create Ranking"}
    </button>
  );
}
