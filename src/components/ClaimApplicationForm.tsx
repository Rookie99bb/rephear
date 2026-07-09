"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  submitClaimRequestAction,
  type ActionResult,
} from "@/lib/actions/claimRequests";

const initialState: ActionResult = {};

export default function ClaimApplicationForm({
  profileId,
}: {
  profileId: string;
}) {
  const actionWithProfile = submitClaimRequestAction.bind(null, profileId);
  const [state, formAction] = useFormState(actionWithProfile, initialState);

  return (
    <form action={formAction} encType="multipart/form-data" className="flex flex-col gap-4">
      <Field
        label="LinkedIn profile"
        name="linkedinUrl"
        type="url"
        placeholder="https://linkedin.com/in/…"
      />
      <Field
        label="Company website"
        name="companyWebsite"
        type="url"
        placeholder="https://…"
      />
      <Field
        label="Official social media profile"
        name="socialMediaUrl"
        type="url"
        placeholder="https://…"
      />
      <Field
        label="Official email"
        name="officialEmail"
        type="email"
        placeholder="you@company.com"
      />
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">Personal statement</span>
        <textarea
          name="personalStatement"
          required
          rows={4}
          placeholder="Explain who you are and why this profile is yours."
          className="rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-ink"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">Additional notes (optional)</span>
        <textarea
          name="additionalNotes"
          rows={2}
          className="rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-ink"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">
          Supporting file (optional)
        </span>
        <input
          name="supportingFile"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="rounded-xl border border-border px-3 py-2.5 text-sm outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-surface file:px-3 file:py-1.5 file:text-sm"
        />
        <span className="text-xs text-subtle">
          PDF, JPG, or PNG. Max 10 MB.
        </span>
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}

function Field({
  label,
  name,
  type,
  placeholder,
}: {
  label: string;
  name: string;
  type: string;
  placeholder: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-ink">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        className="rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-ink"
      />
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 self-start rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Submitting…" : "Submit Claim Application"}
    </button>
  );
}
