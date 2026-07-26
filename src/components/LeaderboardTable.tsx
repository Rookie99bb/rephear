import NomineeCard from "@/components/NomineeCard";
import type { LeaderboardEntry } from "@/lib/types";

export default function LeaderboardTable({
  title,
  icon,
  entries,
  emphasis,
  rankingId,
  city,
  country,
  engagement,
  loggedIn,
}: {
  title: string;
  icon: string;
  entries: LeaderboardEntry[];
  emphasis: "likes" | "credits";
  rankingId: string;
  city: string;
  country: string;
  engagement: Map<string, { likeCount: number; allowedLikes: number }>;
  loggedIn: boolean;
}) {
  return (
    <div>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-subtle">
        {icon} {title}
      </h2>
      {entries.length === 0 ? (
        <p className="text-sm text-subtle">No nominees yet.</p>
      ) : (
        <ol className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry, index) => (
            <NomineeCard
              key={entry.profile.id}
              rank={index + 1}
              entry={entry}
              city={city}
              country={country}
              rankingId={rankingId}
              likeCount={engagement.get(entry.profile.id)?.likeCount ?? 0}
              allowedLikes={engagement.get(entry.profile.id)?.allowedLikes ?? 1}
              loggedIn={loggedIn}
              emphasis={emphasis}
            />
          ))}
        </ol>
      )}
    </div>
  );
}
