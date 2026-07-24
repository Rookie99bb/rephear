import { getAdminStats } from "@/db/adminStats";

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-subtle">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-subtle">{hint}</p>}
    </div>
  );
}

function formatUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));

export default async function AdminAnalyticsPage() {
  const stats = await getAdminStats();

  const dayMax = Math.max(1, ...stats.activityByDay.map((d) => d.count));
  const signupMax = Math.max(1, ...stats.signupsByDay.map((d) => d.count));
  const hourByLabel = new Map(stats.activityByHour.map((h) => [h.hour, h.count]));
  const hourMax = Math.max(1, ...stats.activityByHour.map((h) => h.count));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-subtle">
          Overview
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard label="Registered users" value={stats.totalUsers.toLocaleString()} />
          <StatCard
            label="Active rankings"
            value={stats.totalActiveRankings.toLocaleString()}
            hint={`${stats.totalHiddenOrDeletedRankings.toLocaleString()} hidden/deleted`}
          />
          <StatCard label="Total likes" value={stats.totalLikes.toLocaleString()} />
          <StatCard label="Total shares" value={stats.totalShares.toLocaleString()} />
          <StatCard
            label="Support payments"
            value={stats.totalCompletedSupportCount.toLocaleString()}
            hint="completed checkouts"
          />
          <StatCard
            label="Support revenue"
            value={formatUsd(stats.totalSupportAmountCents)}
          />
          <StatCard
            label="Credits granted"
            value={stats.totalCreditsGranted.toLocaleString()}
          />
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-subtle">
          By Region
        </h2>
        {stats.regionBreakdown.length === 0 ? (
          <p className="text-sm text-subtle">No Rankings yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-subtle">
                  <th className="py-2 pr-4 font-medium">City</th>
                  <th className="py-2 pr-4 font-medium">Country</th>
                  <th className="py-2 pr-4 font-medium">Rankings</th>
                  <th className="py-2 pr-4 font-medium">Likes</th>
                </tr>
              </thead>
              <tbody>
                {stats.regionBreakdown.map((r) => (
                  <tr key={`${r.country}-${r.city}`} className="border-b border-border/60">
                    <td className="py-2 pr-4 font-medium text-ink">{r.city}</td>
                    <td className="py-2 pr-4 text-subtle">{r.country}</td>
                    <td className="py-2 pr-4 text-subtle">{r.rankingCount}</td>
                    <td className="py-2 pr-4 text-subtle">{r.likeCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-subtle">
          Activity, last 30 days
        </h2>
        <p className="mb-4 text-xs text-subtle">
          Likes + shares (activity) and new signups, by day.
        </p>
        {stats.activityByDay.length === 0 && stats.signupsByDay.length === 0 ? (
          <p className="text-sm text-subtle">No activity in the last 30 days.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <DayBarChart title="Activity (likes + shares)" data={stats.activityByDay} max={dayMax} />
            <DayBarChart title="New signups" data={stats.signupsByDay} max={signupMax} />
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-subtle">
          Activity by hour of day
        </h2>
        <p className="mb-4 text-xs text-subtle">
          When users are active (likes + shares, all time, UTC hour).
        </p>
        <div className="flex items-end gap-1 rounded-xl border border-border p-4">
          {HOUR_LABELS.map((h) => {
            const count = hourByLabel.get(h) ?? 0;
            const heightPct = Math.max(4, Math.round((count / hourMax) * 100));
            return (
              <div key={h} className="flex flex-1 flex-col items-center gap-1">
                <div
                  title={`${h}:00 UTC — ${count}`}
                  className="w-full rounded-t bg-ink"
                  style={{ height: `${heightPct}px`, minHeight: "4px" }}
                />
                <span className="text-[9px] text-subtle">{h}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DayBarChart({
  title,
  data,
  max,
}: {
  title: string;
  data: { day: string; count: number }[];
  max: number;
}) {
  if (data.length === 0) {
    return (
      <div>
        <p className="mb-2 text-xs font-medium text-ink">{title}</p>
        <p className="text-xs text-subtle">No data yet.</p>
      </div>
    );
  }
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-ink">{title}</p>
      <div className="flex flex-col gap-1">
        {data.map((d) => (
          <div key={d.day} className="flex items-center gap-2 text-xs">
            <span className="w-20 shrink-0 text-subtle">{d.day}</span>
            <div className="h-2.5 flex-1 rounded bg-surface">
              <div
                className="h-2.5 rounded bg-ink"
                style={{ width: `${Math.max(2, Math.round((d.count / max) * 100))}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-subtle">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
