"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { addNomineeAction, type ActionResult } from "@/lib/actions/nominees";
import type { Profile } from "@/lib/types";

const initialState: ActionResult = {};

export default function AddNomineeForm({ rankingId }: { rankingId: string }) {
  const actionWithRanking = addNomineeAction.bind(null, rankingId);
  const [state, formAction] = useFormState(actionWithRanking, initialState);

  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (selected || query.trim().length < 2) {
      setMatches([]);
      return;
    }
    const handle = setTimeout(async () => {
      const res = await fetch(
        `/api/profiles/search?q=${encodeURIComponent(query.trim())}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setMatches(data.profiles ?? []);
    }, 250);
    return () => clearTimeout(handle);
  }, [query, selected]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      {selected ? (
        <input type="hidden" name="profileId" value={selected.id} />
      ) : (
        <input type="hidden" name="profileId" value="" />
      )}

      <div className="relative">
        <input
          name="name"
          value={selected ? selected.name : query}
          onChange={(e) => {
            setSelected(null);
            setQuery(e.target.value);
          }}
          placeholder="Nominee name"
          required
          className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-ink"
        />
        {!selected && matches.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded-xl border border-border bg-white shadow-sm">
            {matches.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(p);
                    setMatches([]);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-surface"
                >
                  Use existing profile:{" "}
                  <span className="font-medium">{p.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!selected && (
        <textarea
          name="bio"
          placeholder="Short bio (optional)"
          rows={2}
          className="rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-ink"
        />
      )}

      {selected && (
        <p className="text-xs text-subtle">
          Adding the existing profile for{" "}
          <span className="font-medium text-ink">{selected.name}</span>.{" "}
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setQuery("");
            }}
            className="underline"
          >
            Clear
          </button>
        </p>
      )}

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
