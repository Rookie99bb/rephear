import Link from "next/link";
import Avatar from "@/components/Avatar";
import type {
  RoadEntry,
  ChallengerEntry,
  CommunityBackerMilestone,
} from "@/db/journeyTimeline";
import {
  formatStoryDate,
  buildMilestoneLabel,
} from "@/lib/storyCopy";

// Phase 5.4 (Support Story §17): ❤️ Road to Top 3 + ❤️ Community on
// the ranking page. Presentational server components.
//
// Road to Top 3 renders ONLY nominees that REACHED the Top 3 (their
// milestone trail from first appearance to now) — never-reached
// nominees get no trail (no aspirational fabrication).
//
// Community is the crowd story in aggregate COUNTS only: total
// backers, backer-count milestones over time (from milestone_events),
// and approaching challengers with their credits gap to #3. No backer
// is ever named. The CTA is a question, never a promise that credits
// buy a rank.
export function RoadToTop3Section({ roads }: { roads: RoadEntry[] }) {
  if (roads.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-subtle">
        ❤️ Road to Top 3
      </h2>
      <p className="mb-3 text-xs text-subtle">
        How the leaders got here — every step backed by a real milestone.
      </p>
      <ul className="flex flex-col gap-3">
        {roads.map((road) => (
          <li
            key={road.profileId}
            className="rounded-xl border border-border px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <Avatar
                name={road.profileName}
                photoUrl={road.profilePhotoUrl ?? undefined}
                size={40}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  <Link
                    href={`/profiles/${road.profileId}`}
                    className="hover:underline"
                  >
                    #{road.rank} {road.profileName}
                  </Link>
                </p>
                <p className="truncate text-xs text-subtle">
                  {road.totalCredits.toLocaleString()} Credits ·{" "}
                  {road.backerCount.toLocaleString()}{" "}
                  {road.backerCount === 1 ? "backer" : "backers"}
                </p>
              </div>
            </div>
            {road.trail.length > 0 && (
              <ol className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-subtle">
                {road.trail.map((t, i) => (
                  <li key={`${t.type}:${t.createdAt}`} className="flex items-center gap-2">
                    {i > 0 && <span aria-hidden>→</span>}
                    <span title={formatStoryDate(t.createdAt) ?? undefined}>
                      {buildMilestoneLabel(t.type, t.rankAtEvent)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CommunitySection({
  totalBackers,
  milestones,
  challengers,
}: {
  totalBackers: number;
  milestones: CommunityBackerMilestone[];
  challengers: ChallengerEntry[];
}) {
  if (totalBackers === 0 && milestones.length === 0 && challengers.length === 0) {
    return null;
  }
  return (
    <section className="mt-10">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-subtle">
        ❤️ Community
      </h2>
      <p className="mb-3 text-xs text-subtle">
        {totalBackers.toLocaleString()}{" "}
        {totalBackers === 1 ? "person is" : "people are"} backing in this
        ranking.
      </p>
      {milestones.length > 0 && (
        <ul className="mb-4 flex flex-col gap-1.5">
          {milestones.map((m) => (
            <li key={`${m.profileId}:${m.createdAt}`} className="text-xs text-subtle">
              <Link
                href={`/profiles/${m.profileId}`}
                className="font-medium text-ink hover:underline"
              >
                {m.profileName}
              </Link>{" "}
              reached {m.backersAtEvent.toLocaleString()} backers
              {formatStoryDate(m.createdAt) && ` · ${formatStoryDate(m.createdAt)}`}
            </li>
          ))}
        </ul>
      )}
      {challengers.length > 0 && (
        <ul className="flex flex-col gap-3">
          {challengers.map((c) => (
            <li
              key={c.profileId}
              className="rounded-xl border border-border px-4 py-3"
            >
              <p className="text-sm font-medium text-ink">
                <Link
                  href={`/profiles/${c.profileId}`}
                  className="hover:underline"
                >
                  #{c.rank} {c.profileName}
                </Link>
              </p>
              <p className="mt-1 text-xs text-subtle">
                {c.totalCredits.toLocaleString()} Credits
                {c.gapToThird != null &&
                  ` · ${c.gapToThird.toLocaleString()} Credits from #3`}
                {` · ${c.backerCount.toLocaleString()} backing`}
              </p>
              <p className="mt-1.5 text-sm text-ink">
                Can the community take {c.profileName} into the Top 3?
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
