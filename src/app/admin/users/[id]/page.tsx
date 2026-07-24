import Link from "next/link";
import { notFound } from "next/navigation";
import { findUserById } from "@/db/users";
import {
  getUserEngagementSummary,
  getUserActivityHistory,
  type UserActivityEntry,
} from "@/db/adminUserStats";
import { getCountryForCity } from "@/lib/locations";
import { formatMoney, formatMoneyBreakdown } from "@/lib/money";
import Avatar from "@/components/Avatar";

// Admin-only user detail view (feature 7). Protected the same way every
// other /admin/* page is: src/app/admin/layout.tsx redirects non-admins
// server-side before this ever renders, and src/middleware.ts blocks
// non-admins at the Edge before that — both independent of this file, no
// extra auth code needed here. Every number on this page comes from
// src/db/adminUserStats.ts, which reads existing tables only (Likes,
// Payments, Rankings, Profiles, Claim Requests) — nothing here is
// hard-coded, estimated, or newly stored.
export default async function AdminUserDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await findUserById(params.id);
  if (!user) notFound();

  const [summary, activity] = await Promise.all([
    getUserEngagementSummary(user.id),
    getUserActivityHistory(user.id),
  ]);

  const country = user.location ? getCountryForCity(user.location) : undefined;

  return (
    <div>
      <Link href="/admin/users" className="text-xs text-subtle hover:text-ink">
        ← Back to Registered Users
      </Link>

      <div className="mt-4 flex items-center gap-4 border-b border-border pb-6">
        <Avatar name={user.name} size={56} />
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            {user.name}
          </h2>
          <p className="text-sm text-subtle">{user.email}</p>
          <p className="mt-1 text-xs text-subtle">
            {user.location ? (
              <>
                {user.location}
                {country ? `, ${country}` : ""}
                {" · "}
              </>
            ) : null}
            Joined{" "}
            {new Date(user.createdAt).toLocaleDateString(undefined, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {" · "}
            {user.isAdmin ? (
              <span className="font-medium text-ink">Admin</span>
            ) : (
              "Member"
            )}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryStat value={summary.likesGiven.toLocaleString()} label="Likes Given" />
        <SummaryStat
          value={formatMoneyBreakdown(summary.supportAmounts)}
          label="Support Given"
          hint={
            summary.supportActionsCount > 0
              ? `${summary.supportActionsCount.toLocaleString()} Support ${
                  summary.supportActionsCount === 1 ? "action" : "actions"
                }`
              : undefined
          }
        />
        <SummaryStat
          value={summary.rankingsCreated.toLocaleString()}
          label="Rankings Created"
        />
        <SummaryStat
          value={summary.nominationsMade.toLocaleString()}
          label="Nominations Made"
        />
      </div>

      <div className="mt-10">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-subtle">
          Activity History
        </h3>
        {activity.length === 0 ? (
          <p className="text-sm text-subtle">No activity yet.</p>
        ) : (
          <ul className="space-y-5">
            {activity.map((entry, i) => (
              <ActivityRow key={`${entry.type}-${i}-${entry.createdAt}`} entry={entry} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SummaryStat({
  value,
  label,
  hint,
}: {
  value: string;
  label: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-2xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-subtle">
        {label}
      </p>
      {hint && <p className="mt-0.5 text-xs text-subtle">{hint}</p>}
    </div>
  );
}

// Every timestamp this page reads (likes.created_at, payments.completed_at,
// rankings.created_at, etc.) is written by SQLite's datetime('now') as a
// space-separated "YYYY-MM-DD HH:MM:SS" string in UTC (see src/db/schema.ts).
// That format isn't reliably parsed as UTC by `new Date(...)` on its own —
// appending "T" + "Z" makes it unambiguous.
function formatTimestamp(iso: string): string {
  const d = new Date(iso.replace(" ", "T") + "Z");
  const date = d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date} · ${time}`;
}

function ProfileLink({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/profiles/${id}`} className="font-medium text-ink hover:underline">
      {name}
    </Link>
  );
}

// Rankings only link when not hidden/deleted — see the "linkableExpr"
// comment in src/db/adminUserStats.ts for why a hidden/deleted Ranking
// stays plain text instead of a link here.
function RankingContext({
  title,
  city,
  country,
  linkable,
  rankingId,
}: {
  title: string;
  city: string;
  country: string;
  linkable: boolean;
  rankingId: string;
}) {
  return (
    <p className="text-sm text-subtle">
      {linkable ? (
        <Link href={`/rankings/${rankingId}`} className="hover:underline">
          {title}
        </Link>
      ) : (
        title
      )}
      {" — "}
      {city || country}
    </p>
  );
}

function ActivityRow({ entry }: { entry: UserActivityEntry }) {
  return (
    <li className="border-b border-border/60 pb-5 last:border-0 last:pb-0">
      <p className="text-xs text-subtle">{formatTimestamp(entry.createdAt)}</p>
      {entry.type === "like" && (
        <>
          <p className="mt-1 text-sm text-ink">
            Liked <ProfileLink id={entry.profileId} name={entry.profileName} />
            {entry.count > 1 ? ` (×${entry.count})` : ""}
          </p>
          <RankingContext
            title={entry.rankingTitle}
            city={entry.city}
            country={entry.country}
            linkable={entry.rankingLinkable}
            rankingId={entry.rankingId}
          />
        </>
      )}
      {entry.type === "support" && (
        <>
          <p className="mt-1 text-sm text-ink">
            Supported <ProfileLink id={entry.profileId} name={entry.profileName} />
          </p>
          <p className="text-sm text-subtle">
            {formatMoney(entry.amountCents, entry.currency)} ·{" "}
            {entry.credits.toLocaleString()} Reputation Credits
          </p>
          <RankingContext
            title={entry.rankingTitle}
            city={entry.city}
            country={entry.country}
            linkable={entry.rankingLinkable}
            rankingId={entry.rankingId}
          />
        </>
      )}
      {entry.type === "ranking_created" && (
        <>
          <p className="mt-1 text-sm text-ink">Created a ranking</p>
          <p className="text-sm text-subtle">
            {entry.rankingLinkable ? (
              <Link href={`/rankings/${entry.rankingId}`} className="hover:underline">
                {entry.rankingTitle}
              </Link>
            ) : (
              entry.rankingTitle
            )}
          </p>
          <p className="text-sm text-subtle">
            {[entry.city, entry.country].filter(Boolean).join(", ")}
          </p>
        </>
      )}
      {entry.type === "nomination" && (
        <>
          <p className="mt-1 text-sm text-ink">
            Nominated <ProfileLink id={entry.profileId} name={entry.profileName} />
          </p>
          <RankingContext
            title={entry.rankingTitle}
            city={entry.city}
            country={entry.country}
            linkable={entry.rankingLinkable}
            rankingId={entry.rankingId}
          />
        </>
      )}
      {entry.type === "claim" && (
        <>
          <p className="mt-1 text-sm text-ink">Claimed profile</p>
          <p className="text-sm text-subtle">
            <ProfileLink id={entry.profileId} name={entry.profileName} />
          </p>
          <p className="text-sm capitalize text-subtle">{entry.status}</p>
        </>
      )}
    </li>
  );
}
