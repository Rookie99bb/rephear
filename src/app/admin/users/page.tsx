import Link from "next/link";
import { listAllUsers } from "@/db/users";
import { getUserEngagementSummaries } from "@/db/adminUserStats";
import { getCurrentAdmin } from "@/lib/admin";
import { formatMoneyBreakdown } from "@/lib/money";
import Avatar from "@/components/Avatar";
import AdminUserRow from "@/components/AdminUserRow";

// Read-only registration + engagement data (feature 1) plus, inline per
// row, the admin grant/revoke control (feature 3) — see
// setUserAdminAction in src/lib/actions/users.ts. Likes/Support/Activity
// come from getUserEngagementSummaries(), which runs a fixed handful of
// aggregate queries once for every user rather than querying per row —
// see src/db/adminUserStats.ts. There's no pagination yet; fine at MVP
// scale, same trade-off listAllRankingsForAdmin already makes.
export default async function AdminUsersPage() {
  const [users, currentAdmin, engagement] = await Promise.all([
    listAllUsers(),
    getCurrentAdmin(),
    getUserEngagementSummaries(),
  ]);

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-subtle">
          Registered Users
        </h2>
        <p className="text-xs text-subtle">{users.length} total</p>
      </div>

      {users.length === 0 ? (
        <p className="text-sm text-subtle">No users yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-subtle">
                <th className="py-2 pr-4 font-medium">User</th>
                <th className="py-2 pr-4 font-medium">Location</th>
                <th className="py-2 pr-4 font-medium">Joined</th>
                <th className="py-2 pr-4 text-right font-medium">Likes</th>
                <th className="py-2 pr-4 text-right font-medium">Support</th>
                <th className="py-2 pr-4 text-right font-medium">Activity</th>
                <th className="py-2 pr-4 font-medium">Role</th>
                <th className="py-2 pr-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const stats = engagement.get(user.id);
                return (
                  <tr key={user.id} className="border-b border-border/60">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={user.name} size={28} />
                        <div>
                          <p className="font-medium text-ink">{user.name}</p>
                          <p className="text-xs text-subtle">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-subtle">
                      {user.location || "—"}
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap text-subtle">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-ink">
                      {(stats?.likesGiven ?? 0).toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap text-right text-ink">
                      {formatMoneyBreakdown(stats?.supportAmounts ?? [])}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-subtle">
                      {(stats?.activityCount ?? 0).toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-4">
                      {user.isAdmin ? (
                        <span className="rounded bg-ink px-1.5 py-0.5 text-xs font-medium text-white">
                          Admin
                        </span>
                      ) : (
                        <span className="text-xs text-subtle">Member</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="flex flex-col items-start gap-1.5">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface"
                        >
                          View
                        </Link>
                        <AdminUserRow
                          userId={user.id}
                          isAdmin={user.isAdmin}
                          isSelf={user.id === currentAdmin?.id}
                        />
                      </div>
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
