"use client";

import { useState, useTransition } from "react";

// Report + block controls on a public profile (D5). Logged-in,
// non-owner viewers only — the page decides whether to render this.
export default function ProfileReportBlock({
  targetUserId,
  targetName,
  initialBlocked,
}: {
  targetUserId: string;
  targetName: string;
  initialBlocked: boolean;
}) {
  const [blocked, setBlocked] = useState(initialBlocked);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function toggleBlock() {
    setError(null);
    const res = await fetch(`/api/users/${targetUserId}/block`, {
      method: blocked ? "DELETE" : "POST",
    });
    if (!res.ok) {
      setError("Something went wrong. Please try again.");
      return;
    }
    setBlocked(!blocked);
  }

  function submitReport() {
    const trimmed = reason.trim();
    if (trimmed.length < 1 || trimmed.length > 500) {
      setError("Please describe the issue (1–500 characters).");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/users/${targetUserId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: trimmed }),
      });
      if (!res.ok) {
        setError(
          res.status === 429
            ? "You've reached the daily report limit. Please try again tomorrow."
            : "Something went wrong. Please try again."
        );
        return;
      }
      setReportSent(true);
      setReportOpen(false);
      setReason("");
    });
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button
        onClick={toggleBlock}
        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-subtle transition hover:border-ink hover:text-ink"
      >
        {blocked ? "Unblock" : "Block"}
      </button>
      {!reportSent ? (
        <button
          onClick={() => setReportOpen((v) => !v)}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-subtle transition hover:border-ink hover:text-ink"
        >
          Report
        </button>
      ) : (
        <span className="text-xs text-subtle">
          Thanks — our team will review this profile.
        </span>
      )}
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
      {reportOpen && !reportSent && (
        <div className="w-full rounded-xl border border-border p-3">
          <p className="text-xs font-medium text-ink">
            Report {targetName}
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="What seems wrong with this profile?"
            className="mt-2 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink placeholder:text-subtle focus:border-ink focus:outline-none"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => setReportOpen(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-subtle hover:text-ink"
            >
              Cancel
            </button>
            <button
              onClick={submitReport}
              disabled={pending}
              className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Sending…" : "Send report"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
