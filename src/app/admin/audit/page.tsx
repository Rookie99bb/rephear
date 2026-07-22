import Link from "next/link";
import {
  listAuditLogs,
  listDistinctAuditActions,
} from "@/db/auditLog";
import { findUserById } from "@/db/users";

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: {
    action?: string;
    actor?: string;
    date?: string;
    q?: string;
  };
}) {
  const { action, actor, date, q } = searchParams;
  const logs = await listAuditLogs({
    action: action || undefined,
    actorUserId: actor || undefined,
    date: date || undefined,
    search: q || undefined,
  });
  const actions = await listDistinctAuditActions();

  const hasFilters = !!(action || actor || date || q);

  // Resolve every distinct actor once up front — .map() inside the JSX
  // below can't itself be async, so this can't be looked up lazily
  // during render like the old synchronous db calls could.
  const actorUsers = new Map<string, Awaited<ReturnType<typeof findUserById>>>();
  for (const log of logs) {
    if (!actorUsers.has(log.actorUserId)) {
      actorUsers.set(log.actorUserId, await findUserById(log.actorUserId));
    }
  }

  return (
    <div>
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-subtle">
        Audit Log
      </h2>
      <p className="mb-4 text-xs text-subtle">
        Every administrative action is recorded here automatically and can
        never be edited or deleted — this is a permanent record.
      </p>

      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-border p-4 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink">Action</span>
          <select
            name="action"
            defaultValue={action || ""}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs"
          >
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink">Administrator (user id)</span>
          <input
            name="actor"
            defaultValue={actor || ""}
            placeholder="user id"
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink">Date</span>
          <input
            type="date"
            name="date"
            defaultValue={date || ""}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink">Search target</span>
          <input
            name="q"
            defaultValue={q || ""}
            placeholder="ranking/profile id or detail text"
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
        >
          Filter
        </button>
        {hasFilters && (
          <Link href="/admin/audit" className="text-xs text-subtle underline">
            Clear filters
          </Link>
        )}
      </form>

      {logs.length === 0 ? (
        <p className="text-sm text-subtle">No audit log entries match.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-subtle">
                <th className="py-2 pr-4 font-medium">When</th>
                <th className="py-2 pr-4 font-medium">Action</th>
                <th className="py-2 pr-4 font-medium">Administrator</th>
                <th className="py-2 pr-4 font-medium">Target</th>
                <th className="py-2 pr-4 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const actorUser = actorUsers.get(log.actorUserId);
                return (
                  <tr key={log.id} className="border-b border-border/60 align-top">
                    <td className="py-2 pr-4 whitespace-nowrap text-subtle">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 font-medium text-ink">
                      {log.action}
                    </td>
                    <td className="py-2 pr-4 text-subtle">
                      {actorUser?.name ?? "Unknown"}
                      <br />
                      <span className="text-xs">{actorUser?.email}</span>
                    </td>
                    <td className="py-2 pr-4 text-subtle">
                      {log.targetType}
                      <br />
                      <span className="text-xs">{log.targetId}</span>
                    </td>
                    <td className="py-2 pr-4 text-xs text-subtle">
                      <pre className="whitespace-pre-wrap break-all font-sans">
                        {JSON.stringify(log.details)}
                      </pre>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
