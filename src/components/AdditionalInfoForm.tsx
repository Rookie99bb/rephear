"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  submitAdditionalInfoAction,
  type ActionResult,
} from "@/lib/actions/claimRequests";
import type { ClaimRequest } from "@/lib/types";

const initialState: ActionResult = {};

// Shown when a claimant's own application is MORE_INFO_REQUIRED. Fields
// are pre-filled from the claim's current evidence so the applicant is
// editing/adding to what's on file, not starting over from blank —
// nothing here is submitted until they press Submit, and the previous
// evidence is preserved permanently in the audit log regardless (see
// submitAdditionalInfoAction).
export default function AdditionalInfoForm({ request }: { request: ClaimRequest }) {
  const action = submitAdditionalInfoAction.bind(null, request.id);
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction} encType="multipart/form-data" className="flex flex-col gap-4">
      <p className="text-xs text-subtle">
        Provide <strong className="font-medium text-ink">at least one</strong>{" "}
        of the fields below — you don&apos;t need to fill in all of them.
      </p>

      <Field
        label="LinkedIn profile"
        name="linkedinUrl"
        type="url"
        defaultValue={request.linkedinUrl}
        optional
      />
      <Field
        label="Official website"
        name="companyWebsite"
        type="url"
        defaultValue={request.companyWebsite}
        optional
      />
      <Field
        label="Official social media profile"
        name="socialMediaUrl"
        type="url"
        defaultValue={request.socialMediaUrl}
        optional
      />
      <Field
        label="Organization / institution email"
        name="officialEmail"
        type="email"
        defaultValue={request.officialEmail}
        optional
      />
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">Reason for claiming this profile</span>
        <textarea
          name="personalStatement"
          required
          rows={4}
          defaultValue={request.personalStatement}
          className="rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-ink"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">Additional explanation</span>
        <textarea
          name="additionalNotes"
          rows={2}
          defaultValue={request.additionalNotes}
          className="rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-ink"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">New supporting document (optional)</span>
        <input
          name="supportingFile"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="rounded-xl border border-border px-3 py-2.5 text-sm outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-surface file:px-3 file:py-1.5 file:text-sm"
        />
        {request.supportingFilePath && (
          <span className="text-xs text-subtle">
            A supporting file is already on file — uploading a new one replaces it.
          </span>
        )}
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
  defaultValue,
  optional,
}: {
  label: string;
  name: string;
  type: string;
  defaultValue: string;
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
        defaultValue={defaultValue}
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
      {pending ? "Submitting…" : "Submit Additional Information"}
    </button>
  );
}
