import Link from "next/link";
import type { TimelineEntry, JoinMarker } from "@/db/journeyTimeline";
import {
  formatStoryDate,
  buildMilestoneLabel,
  buildJoinMarkerCopy,
} from "@/lib/storyCopy";

// Phase 5.4 (Support Story §10/§11): ❤️ Their RepHear Journey — the
// nominee's milestone trail, generated ONLY from milestone_events rows
// (no event → no milestone, never inferred). Presentational server
// component.
//
// The ❤️ YOU JOINED HERE marker is the VIEWER's own first backing
// moment, merged into the trail at its chronological position — a
// viewer never sees another user's marker. The viewer always sees
// their own marker (🔒 when the moment is currently private, per
// Phase 2 owner-sees-all).
export default function JourneyTimeline({
  nomineeName,
  rankingTitle,
  rankingId,
  profileId,
  entries,
  marker,
}: {
  nomineeName: string;
  rankingTitle: string;
  rankingId: string;
  profileId: string;
  entries: TimelineEntry[];
  marker: JoinMarker | null;
}) {
  if (entries.length === 0) return null;

  type Item =
    | { kind: "event"; at: string; entry: TimelineEntry }
    | { kind: "marker"; at: string; marker: JoinMarker };
  const items: Item[] = entries.map((entry) => ({
    kind: "event" as const,
    at: entry.createdAt,
    entry,
  }));
  if (marker) {
    items.push({ kind: "marker" as const, at: marker.supportedAt, marker });
  }
  // Chronological, earliest → latest. On ties the marker sorts after
  // the event (you joined during that milestone's day).
  items.sort(
    (a, b) =>
      a.at.localeCompare(b.at) ||
      (a.kind === "event" ? -1 : 1)
  );

  return (
    <section className="mt-8">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-subtle">
        ❤️ Their RepHear Journey
      </h2>
      <p className="mb-3 text-xs text-subtle">
        <Link href={`/profiles/${profileId}`} className="hover:underline">
          {nomineeName}
        </Link>
        {" in "}
        <Link href={`/rankings/${rankingId}`} className="hover:underline">
          {rankingTitle}
        </Link>
      </p>
      <ol className="flex flex-col">
        {items.map((item, i) =>
          item.kind === "event" ? (
            <EventRow
              key={`e:${item.entry.type}:${item.at}:${i}`}
              entry={item.entry}
              last={i === items.length - 1}
            />
          ) : (
            <MarkerRow
              key={`m:${item.at}:${i}`}
              marker={item.marker}
              nomineeName={nomineeName}
              last={i === items.length - 1}
            />
          )
        )}
      </ol>
    </section>
  );
}

function buildEntryFacts(entry: TimelineEntry): string[] {
  const facts: string[] = [];
  if (entry.creditsAtEvent != null) {
    facts.push(`${entry.creditsAtEvent.toLocaleString()} Credits`);
  }
  if (entry.backersAtEvent != null && entry.type !== "backers_50") {
    facts.push(`${entry.backersAtEvent.toLocaleString()} backers`);
  }
  return facts;
}

function EventRow({
  entry,
  last,
}: {
  entry: TimelineEntry;
  last: boolean;
}) {
  const date = formatStoryDate(entry.createdAt);
  const facts = buildEntryFacts(entry);
  return (
    <li className={`relative pl-6 ${last ? "" : "pb-5"}`}>
      <span className="absolute left-0 top-1 h-3 w-3 rounded-full border-2 border-border bg-white" />
      {!last && (
        <span className="absolute bottom-0 left-[5px] top-4 w-0.5 bg-border" />
      )}
      <p className="text-sm font-medium text-ink">
        {buildMilestoneLabel(entry.type, entry.rankAtEvent)}
      </p>
      <p className="mt-0.5 text-xs text-subtle">
        {date}
        {facts.length > 0 && ` · ${facts.join(" · ")}`}
      </p>
    </li>
  );
}

function MarkerRow({
  marker,
  nomineeName,
  last,
}: {
  marker: JoinMarker;
  nomineeName: string;
  last: boolean;
}) {
  const date = formatStoryDate(marker.supportedAt);
  return (
    <li className={`relative pl-6 ${last ? "" : "pb-5"}`}>
      <span className="absolute left-0 top-1 text-sm leading-none">❤️</span>
      {!last && (
        <span className="absolute bottom-0 left-[5px] top-4 w-0.5 bg-border" />
      )}
      <p className="text-sm font-semibold text-ink">
        YOU JOINED HERE
        {!marker.isPublic && (
          <span
            className="ml-1.5 text-xs font-normal text-subtle"
            title="Only visible to you"
          >
            🔒
          </span>
        )}
      </p>
      <p className="mt-0.5 text-xs text-subtle">
        {buildJoinMarkerCopy(nomineeName, marker.rankAtSupport)}
        {date && ` · ${date}`}
      </p>
    </li>
  );
}
