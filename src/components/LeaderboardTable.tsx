import NomineeCard from "@/components/NomineeCard";
import type { LeaderboardEntry, Ranking } from "@/lib/types";
import type { RankingGeoContext } from "@/lib/nomineeMeta";

export default function LeaderboardTable({
  title,
  subtitle,
  icon,
  entries,
  emphasis,
  rankingId,
  ranking,
  rankingContext,
  userEngagement,
  loggedIn,
  eagerFirst = 0,
  movement,
}: {
  title: string;
  subtitle?: string;
  icon: string;
  entries: LeaderboardEntry[];
  emphasis: "likes" | "credits";
  rankingId: string;
  // The ranking itself — cards derive their location line from its scope
  // via getRankingLocationLabel (scope-only, no ad-hoc concatenation).
  ranking: Ranking;
  // Category/scope context for the entity-kind placeholder art.
  rankingContext: RankingGeoContext;
  // Per-VIEWER engagement: how many times the viewer Liked each nominee
  // and their Like allowance. This is button-gating state ONLY — the
  // public number displayed on each card is entry.organicLikeCount (real
  // user Likes; seed is never displayed).
  userEngagement: Map<string, { userLikeCount: number; allowedLikes: number }>;
  loggedIn: boolean;
  // How many leading cards load their cover image eagerly (above the
  // fold). The rest lazy-load. 0 = all lazy.
  eagerFirst?: number;
  // Phase 3 (§23/§26): per-nominee movement vs the previous daily
  // snapshot, keyed by profile id. Omit/undefined = no snapshot data =
  // no arrows (never infer movement).
  movement?: Map<
    string,
    { direction: "up" | "down" | "same" | "new"; delta: number }
  >;
}) {
  return (
    <div>
      <h2 className={`text-sm font-semibold uppercase tracking-wide text-subtle ${subtitle ? "mb-1" : "mb-4"}`}>
        {icon} {title}
      </h2>
      {subtitle && <p className="mb-4 text-xs text-subtle">{subtitle}</p>}
      {entries.length === 0 ? (
        <p className="text-sm text-subtle">No nominees yet.</p>
      ) : (
        <ol className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry, index) => (
            <NomineeCard
              key={entry.profile.id}
              rank={index + 1}
              entry={entry}
              ranking={ranking}
              rankingContext={rankingContext}
              rankingId={rankingId}
              // PUBLIC organic total: real user Likes only. Seed scores
              // influence cold-start ORDER but are never displayed.
              publicOrganicLikeCount={entry.organicLikeCount}
              // VIEWER's own likes: button gating only, never displayed.
              userLikeCount={userEngagement.get(entry.profile.id)?.userLikeCount ?? 0}
              allowedLikes={userEngagement.get(entry.profile.id)?.allowedLikes ?? 1}
              loggedIn={loggedIn}
              emphasis={emphasis}
              priority={index < eagerFirst}
              creditsGap={
                emphasis === "credits" && index > 0
                  ? entries[index - 1].supportScore - entry.supportScore
                  : null
              }
              movement={movement?.get(entry.profile.id) ?? null}
            />
          ))}
        </ol>
      )}
    </div>
  );
}
