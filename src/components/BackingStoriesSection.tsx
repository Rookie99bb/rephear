import Link from "next/link";
import Avatar from "@/components/Avatar";
import type { BackingStory } from "@/db/backingStories";
import {
  formatStoryDate,
  buildBeforeAfterCopy,
  buildEarlyBadgeCopy,
  buildRankArrow,
  resolveStoryReasonEcho,
} from "@/lib/storyCopy";

// Phase 5.3 (Support Story): ❤️ My Backing Stories — every tracked
// support rendered as a THEN → NOW story card. Presentational server
// component; the page fetches rows via getBackingStories (visibility
// already gated for the viewer: owner sees all, others see
// effective-public moments only; custom reason text reaches the owner
// only).
//
// Declined ranks are kept and rendered honestly ("#23 → #41") —
// stories are not an investment portfolio. "I Was There Early" appears
// ONLY on data-proven climbs, never on flat/declined data.
export default function BackingStoriesSection({
  stories,
  isOwner,
}: {
  stories: BackingStory[];
  isOwner: boolean;
}) {
  if (stories.length === 0) return null;

  const hasLegacy = stories.some((s) => s.kind === "legacy");
  const anchored = new Set<string>();

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-subtle">
        My Backing Stories
      </h2>
      {hasLegacy && (
        <p className="mb-3 text-xs text-subtle">
          Backing stories tracked from Sep 29, 2026 — older supports show
          less detail.
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {stories.map((story) => {
          const anchorKey = `${story.profileId}:${story.rankingId}`;
          const anchorId = anchored.has(anchorKey)
            ? undefined
            : `story-${story.profileId}-${story.rankingId}`;
          anchored.add(anchorKey);
          return (
            <li
              key={
                story.kind === "moment"
                  ? `moment:${story.id}`
                  : `legacy:${story.rankingId}:${story.profileId}`
              }
              id={anchorId}
              className="rounded-xl border border-border px-4 py-3"
            >
              <StoryHeader story={story} isOwner={isOwner} />
              {story.kind === "moment" ? (
                <MomentBody story={story} />
              ) : (
                <LegacyBody story={story} />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function StoryHeader({
  story,
  isOwner,
}: {
  story: BackingStory;
  isOwner: boolean;
}) {
  const date =
    story.kind === "moment"
      ? formatStoryDate(story.supportedAt)
      : formatStoryDate(story.firstSupportedAt);
  return (
    <div className="flex items-center gap-3">
      <Avatar
        name={story.profileName}
        photoUrl={story.profilePhotoUrl ?? undefined}
        size={40}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">
          <Link
            href={`/profiles/${story.profileId}`}
            className="hover:underline"
          >
            {story.profileName}
          </Link>
          {isOwner && !story.isPublic && (
            <span className="ml-1.5 text-xs text-subtle" title="Only visible to you">
              🔒
            </span>
          )}
        </p>
        <p className="truncate text-xs text-subtle">
          <Link
            href={`/rankings/${story.rankingId}`}
            className="hover:underline"
          >
            {story.rankingTitle}
          </Link>
          {date && <span> · {date}</span>}
        </p>
      </div>
    </div>
  );
}

function MomentBody({ story }: { story: Extract<BackingStory, { kind: "moment" }> }) {
  const thenNow = buildBeforeAfterCopy({
    profileName: story.profileName,
    rankAtSupport: story.rankAtSupport,
    currentRank: story.currentRank,
  });
  const arrow = buildRankArrow(story.rankAtSupport, story.currentRank);
  const badge = buildEarlyBadgeCopy(story.rankAtSupport, story.currentRank);
  const reason = resolveStoryReasonEcho(story.supportReason, story.supportReasonText);

  const thenParts: string[] = [];
  if (story.rankAtSupport != null) thenParts.push(`ranked #${story.rankAtSupport}`);
  if (story.totalCreditsAtSupport != null)
    thenParts.push(`${story.totalCreditsAtSupport.toLocaleString()} Credits`);
  if (story.backerCountAtSupport != null)
    thenParts.push(`${story.backerCountAtSupport.toLocaleString()} backers`);

  const nowParts: string[] = [];
  if (story.currentRank != null) nowParts.push(`#${story.currentRank}`);
  if (story.currentCredits != null)
    nowParts.push(`${story.currentCredits.toLocaleString()} Credits`);

  return (
    <div className="mt-2.5 space-y-1.5 text-sm">
      {arrow && (
        <p className="text-base font-semibold tracking-tight text-ink">{arrow}</p>
      )}
      {thenNow && <p className="text-subtle">{thenNow}</p>}
      {badge && (
        <p className="text-sm font-medium text-ink">{badge}</p>
      )}
      {thenParts.length > 0 && (
        <p className="text-xs text-subtle">When you backed: {thenParts.join(" · ")}</p>
      )}
      {story.backerNumber != null && (
        <p className="text-xs text-subtle">
          You became Backer #{story.backerNumber} · backed with{" "}
          {story.credits.toLocaleString()} Credits
        </p>
      )}
      {nowParts.length > 0 && (
        <p className="text-xs text-subtle">Now: {nowParts.join(" · ")}</p>
      )}
      {reason && (
        <p className="text-xs italic text-subtle">{reason}</p>
      )}
    </div>
  );
}

function LegacyBody({ story }: { story: Extract<BackingStory, { kind: "legacy" }> }) {
  const thenNow = buildBeforeAfterCopy({
    profileName: story.profileName,
    rankAtSupport: story.rankAtFirstSupport,
    currentRank: story.currentRank,
  });
  const arrow = buildRankArrow(story.rankAtFirstSupport, story.currentRank);
  const badge = buildEarlyBadgeCopy(story.rankAtFirstSupport, story.currentRank);

  return (
    <div className="mt-2.5 space-y-1.5 text-sm">
      {arrow && (
        <p className="text-base font-semibold tracking-tight text-ink">{arrow}</p>
      )}
      {thenNow ? (
        <p className="text-subtle">{thenNow}</p>
      ) : (
        <p className="text-subtle">
          You backed {story.profileName} before story tracking began.
        </p>
      )}
      {badge && <p className="text-sm font-medium text-ink">{badge}</p>}
      {story.currentRank != null && (
        <p className="text-xs text-subtle">
          Now #{story.currentRank} in Most Supported
        </p>
      )}
    </div>
  );
}
