"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  dismissReportAction,
  hideUserAction,
  unhideUserAction,
} from "@/lib/actions/moderation";
import type { PendingUserReport } from "@/db/userReports";

// One row in the admin "User reports" queue: reporter → target, reason,
// time, plus Dismiss / Hide profile / Unhide actions.
export default function UserReportRow({
  report,
}: {
  report: PendingUserReport;
}) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [hidden, setHidden] = useState(report.targetHidden);

  if (done) return null;

  return (
    <li className="rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-ink">
            <Link
              href={`/u/${report.reporterUserId}`}
              className="font-medium hover:underline"
            >
              {report.reporterName}
            </Link>
            <span className="text-subtle"> reported </span>
            <Link
              href={`/u/${report.targetUserId}`}
              className="font-medium hover:underline"
            >
              {report.targetName}
            </Link>
            {hidden && (
              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                Hidden
              </span>
            )}
          </p>
          <p className="mt-1 break-words text-sm text-subtle">
            “{report.reason}”
          </p>
          <p className="mt-1 text-xs text-subtle">{report.createdAt}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await dismissReportAction(report.id);
                setDone(true);
              })
            }
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface disabled:opacity-50"
          >
            Dismiss
          </button>
          {hidden ? (
            <button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await unhideUserAction(report.targetUserId);
                  setHidden(false);
                })
              }
              className="rounded-lg border border-emerald-700 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-700 hover:text-white disabled:opacity-50"
            >
              Unhide
            </button>
          ) : (
            <button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await hideUserAction(report.targetUserId);
                  setHidden(true);
                })
              }
              className="rounded-lg border border-red-700 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-700 hover:text-white disabled:opacity-50"
            >
              Hide profile
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
