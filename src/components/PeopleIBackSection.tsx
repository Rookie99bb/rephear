import Link from "next/link";
import Avatar from "@/components/Avatar";
import type { PeopleIBackRow } from "@/db/publicProfiles";
import {
  buildJourneyProgressCopy,
  resolveStoryReasonEcho,
} from "@/lib/storyCopy";

// People I Back (D2 base + Phase 5.3 v2): backed-at rank → current rank
// + movement, enriched with latest reason echo, journey progress, and
// [View Story] deep links into My Backing Stories.
//
// Presentational server component; the page fetches rows via
// getPeopleIBack (visibility already gated for the viewer). Reason
// custom text reaches the owner only (DB layer); presets are
// public-safe.
export default function PeopleIBackSection({
  rows,
  targetUserId,
}: {
  rows: PeopleIBackRow[];
  targetUserId: string;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-subtle">
        People I Back
      </h2>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => {
          const reason = resolveStoryReasonEcho(
            row.latestReason,
            row.latestReasonText
          );
          const journey = buildJourneyProgressCopy(
            row.journeyFrom,
            row.journeyTo
          );
          return (
            <li
              key={`${row.rankingId}:${row.profileId}`}
              className="rounded-xl border border-border px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Link href={`/profiles/${row.profileId}`}>
                  <Avatar
                    name={row.profileName}
                    photoUrl={row.profilePhotoUrl ?? undefined}
                    size={40}
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    <Link
                      href={`/profiles/${row.profileId}`}
                      className="hover:underline"
                    >
                      {row.profileName}
                    </Link>
                    {!row.isPublic && (
                      <span
                        className="ml-1.5 text-xs text-subtle"
                        title="Only visible to you"
                      >
                        🔒
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-subtle">
                    {row.rankingTitle}
                  </p>
                  {reason && (
                    <p className="truncate text-xs italic text-subtle">
                      {reason}
                    </p>
                  )}
                  {journey && (
                    <p className="truncate text-xs text-subtle">
                      Journey: {journey}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right text-xs text-subtle">
                  {row.rankAtFirstSupport != null && (
                    <p>
                      Backed at{" "}
                      <span className="font-medium text-ink">
                        #{row.rankAtFirstSupport}
                      </span>
                    </p>
                  )}
                  {row.currentRank != null && (
                    <p>
                      Now{" "}
                      <span className="font-medium text-ink">
                        #{row.currentRank}
                      </span>{" "}
                      {row.movement != null && row.movement !== 0 && (
                        <span
                          className={
                            row.movement > 0
                              ? "text-emerald-600"
                              : "text-red-500"
                          }
                        >
                          {row.movement > 0
                            ? `↑${row.movement}`
                            : `↓${-row.movement}`}
                        </span>
                      )}
                      {row.movement === 0 && <span>–</span>}
                    </p>
                  )}
                  <p className="mt-1">
                    <Link
                      href={`/u/${targetUserId}#story-${row.profileId}-${row.rankingId}`}
                      className="font-medium text-ink hover:underline"
                    >
                      View Story →
                    </Link>
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
