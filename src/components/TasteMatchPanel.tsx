import Link from "next/link";
import Avatar from "@/components/Avatar";
import type { TasteMatchResult } from "@/db/publicProfiles";

// Taste Match v1 panel (D4). Renders ONLY when the caller passes a
// non-null result — all gates (≥3 public actions each side, ≥3 shared,
// no seed, no blocks, no hidden users) are enforced in getTasteMatch.
// There is deliberately no "not enough data" state: a hint would leak
// activity level.
export default function TasteMatchPanel({
  match,
  targetName,
}: {
  match: TasteMatchResult;
  targetName: string;
}) {
  return (
    <section className="mt-8 rounded-xl border border-border p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-subtle">
        Taste Match
      </h2>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">
        {match.scorePct}%
      </p>
      <p className="mt-1 text-sm text-subtle">
        You and {targetName} liked/backed {match.sharedCount} of the same
        nominees
      </p>
      {match.sharedNominees.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {match.sharedNominees.map((n) => (
            <li key={n.profileId}>
              <Link
                href={`/profiles/${n.profileId}`}
                className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 hover:border-ink"
              >
                <Avatar name={n.name} photoUrl={n.photoUrl ?? undefined} size={24} />
                <span className="text-xs font-medium text-ink">{n.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
