import Link from "next/link";
import Avatar from "@/components/Avatar";
import LikeButton from "@/components/LikeButton";
import type { LeaderboardEntry } from "@/lib/types";

export default function LeaderboardTable({
  title,
  icon,
  entries,
  emphasis,
  rankingId,
  likedProfileIds,
  loggedIn,
}: {
  title: string;
  icon: string;
  entries: LeaderboardEntry[];
  emphasis: "likes" | "credits";
  rankingId: string;
  likedProfileIds: Set<string>;
  loggedIn: boolean;
}) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-subtle">
        {icon} {title}
      </h2>
      {entries.length === 0 ? (
        <p className="text-sm text-subtle">No nominees yet.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {entries.map((entry, index) => (
            <li
              key={entry.profile.id}
              className="flex flex-col gap-3 rounded-xl border border-border px-4 py-3 sm:flex-row sm:items-center"
            >
              <div className="flex flex-1 items-center gap-3 min-w-0">
                <span className="w-5 shrink-0 text-sm font-semibold text-subtle">
                  {index + 1}
                </span>
                <Link
                  href={`/profiles/${entry.profile.id}`}
                  className="flex flex-1 items-center gap-3 min-w-0"
                >
                  <Avatar name={entry.profile.name} size={32} />
                  <span className="truncate text-sm font-medium text-ink">
                    {entry.profile.name}
                  </span>
                </Link>
              </div>
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <div className="flex items-center gap-4 text-sm">
                  <Stat
                    value={entry.likeCount}
                    label="Likes"
                    emphasized={emphasis === "likes"}
                  />
                  <Stat
                    value={entry.reputationCredits}
                    label="Credits"
                    emphasized={emphasis === "credits"}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <LikeButton
                    rankingId={rankingId}
                    profileId={entry.profile.id}
                    initiallyLiked={likedProfileIds.has(entry.profile.id)}
                    loggedIn={loggedIn}
                  />
                  {loggedIn ? (
                    <Link
                      href={`/rankings/${rankingId}/support/${entry.profile.id}`}
                      className="rounded-lg border border-ink px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-ink hover:text-white"
                    >
                      Support
                    </Link>
                  ) : (
                    <span className="rounded-lg border border-border px-3 py-1.5 text-xs text-subtle">
                      Log in to Support
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Stat({
  value,
  label,
  emphasized,
}: {
  value: number;
  label: string;
  emphasized: boolean;
}) {
  return (
    <div className="text-right">
      <p
        className={`font-semibold ${emphasized ? "text-ink" : "text-subtle"}`}
      >
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-subtle">
        {label}
      </p>
    </div>
  );
}
