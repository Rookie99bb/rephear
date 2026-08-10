"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  submitClaimRequestAction,
  type ActionResult,
} from "@/lib/actions/claimRequests";

const initialState: ActionResult = {};

const CLAIM_TYPES: { value: string; label: string }[] = [
  { value: "self", label: "I am this person" },
  { value: "representative", label: "I officially represent this person" },
  { value: "organization", label: "I manage this organization" },
];

export default function ClaimApplicationForm({
  profileId,
}: {
  profileId: string;
}) {
  const actionWithProfile = submitClaimRequestAction.bind(null, profileId);
  const [state, formAction] = useFormState(actionWithProfile, initialState);

  return (
    <form action={formAction} encType="multipart/form-data" className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-1.5 text-sm">
        <legend className="font-medium text-ink">Claim type</legend>
        {CLAIM_TYPES.map((t, i) => (
          <label key={t.value} className="flex items-center gap-2 text-sm text-ink">
            <input
              type="radio"
              name="claimType"
              value={t.value}
              defaultChecked={i === 0}
              required
            />
            {t.label}
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">Full legal name</span>
        <input
          name="fullLegalName"
          type="text"
          required
          placeholder="Your full legal name"
          className="rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-ink"
        />
      </label>

      <p className="text-xs text-subtle">
        We don&apos;t require a government ID by default. Provide{" "}
        <strong className="font-medium text-ink">at least one</strong> of the
        fields below as evidence — LinkedIn, an official website, an official
        social profile, or an official email are all accepted, and you only
        need one.
      </p>

      <Field
        label="LinkedIn profile"
        name="linkedinUrl"
        type="url"
        placeholder="https://linkedin.com/in/…"
        optional
      />
      <Field
        label="Official website"
        name="companyWebsite"
        type="url"
        placeholder="https://…"
        optional
      />
      <Field
        label="Official social media profile"
        name="socialMediaUrl"
        type="url"
        placeholder="https://…"
        optional
      />
      <Field
        label="Organization / institution email"
        name="officialEmail"
        type="email"
        placeholder="you@company.com"
        optional
      />
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">Reason for claiming this profile</span>
        <textarea
          name="personalStatement"
          required
          rows={4}
          placeholder="Explain who you are and why this profile is yours."
          className="rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-ink"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">Additional explanation (optional)</span>
        <textarea
          name="additionalNotes"
          rows={2}
          className="rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-ink"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">
          Supporting document (optional)
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
  optional,
}: {
  label: string;
  name: string;
  type: string;
  placeholder: string;
  optional?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-ink">
        {label}
        {optional && (
          <span className="ml-1.5 font-normal text-subtle">(optional)</span>
        )}
      </span>
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
