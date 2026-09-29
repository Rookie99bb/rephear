import Link from "next/link";
import Avatar from "@/components/Avatar";
import type { PeopleIBackRow } from "@/db/publicProfiles";

// People I Back base (D2): backed-at rank → current rank + movement.
// Presentational server component; the page fetches rows via
// getPeopleIBack (visibility already gated for the viewer).
export default function PeopleIBackSection({
  rows,
}: {
  rows: PeopleIBackRow[];
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-subtle">
        People I Back
      </h2>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={`${row.rankingId}:${row.profileId}`}>
            <Link
              href={`/profiles/${row.profileId}`}
              className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 hover:border-ink"
            >
              <Avatar
                name={row.profileName}
                photoUrl={row.profilePhotoUrl ?? undefined}
                size={40}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {row.profileName}
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
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
