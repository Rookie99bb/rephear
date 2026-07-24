"use client";

import { useState, useTransition } from "react";
import { setUserAdminAction } from "@/lib/actions/users";

export default function AdminUserRow({
  userId,
  isAdmin,
  isSelf,
}: {
  userId: string;
  isAdmin: boolean;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [admin, setAdmin] = useState(isAdmin);
  const [error, setError] = useState<string | null>(null);

  if (isSelf) {
    return <span className="text-xs text-subtle">This is you</span>;
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        disabled={pending}
        onClick={() => {
          const next = !admin;
          if (
            !next &&
            !confirm(
              "Remove admin access for this user? They will immediately lose access to the Admin Panel."
            )
          ) {
            return;
          }
          setError(null);
          const previous = admin;
          setAdmin(next);
          startTransition(async () => {
            const result = await setUserAdminAction(userId, next);
            if (result.error) {
              setAdmin(previous);
              setError(result.error);
            }
          });
        }}
        className={`rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
          admin
            ? "border-red-700 text-red-700 hover:bg-red-700 hover:text-white"
            : "border-border text-ink hover:bg-surface"
        }`}
      >
        {pending ? "Saving…" : admin ? "Remove admin" : "Make admin"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
