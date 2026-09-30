import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { findUserById } from "@/db/users";
import { isBlocked, isBlockedEither } from "@/db/userReports";
import { likedItemsForUser, likedPublicItemsForUser } from "@/db/likes";
import {
  getInterestTags,
  getIdentityStats,
  getPeopleIBack,
  getTasteMatch,
  hasPublicActivity,
} from "@/db/publicProfiles";
import { getBackingStories } from "@/db/backingStories";
import { findProfilesClaimedByUser } from "@/db/profiles";
import { findRankingById } from "@/db/rankings";
import {
  getJourneyTimeline,
  getViewerJoinMarker,
} from "@/db/journeyTimeline";
import Avatar from "@/components/Avatar";
import PeopleIBackSection from "@/components/PeopleIBackSection";
import BackingStoriesSection from "@/components/BackingStoriesSection";
import JourneyTimeline from "@/components/JourneyTimeline";
import TasteMatchPanel from "@/components/TasteMatchPanel";
import { getIdentityAwards, visibleIdentityAwards } from "@/db/identityAwards";
import StoryCardsPanel from "@/components/StoryCardsPanel";
import IdentityBadges from "@/components/IdentityBadges";
import ProfileReportBlock from "@/components/ProfileReportBlock";
import NotificationBell from "@/components/NotificationBell";

// Phase 2 (public identity): public profile at /u/[id] using the opaque
// users.id (non-enumerable — no handle system in Phase 2).
//
// Privacy posture:
//  - Unknown id → 404. Hidden (moderated) profile → "unavailable" to
//    EVERYONE, including the owner (admins use the admin panel).
//  - Blocked either direction → "unavailable" (never reveals direction).
//  - Owner sees everything, with a discreet 🔒 on private items.
//  - Anyone else sees effective-public rows only. A fully-private
//    profile renders header + "This user keeps their activity private."
//    — no lists, no counts derived from private actions.
//  - Taste Match renders only when getTasteMatch returns non-null; there
//    is deliberately no "not enough data" hint (it would leak activity
//    level). No public API oracle exists for the score.
// Deliberately NOT added to the sitemap (no indexing personal data
// without a legal call).
export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const target = await findUserById(params.id);
  if (!target || target.isHidden) {
    return { title: "Profile unavailable" };
  }
  return { title: `${target.name} on RepHear` };
}

function Unavailable() {
  return (
    <div className="mx-auto max-w-2xl py-16 text-center">
      <p className="text-sm text-subtle">This profile is unavailable.</p>
    </div>
  );
}

export default async function UserProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const target = await findUserById(params.id);
  if (!target) notFound();
  if (target.isHidden) return <Unavailable />;

  const viewer = await getCurrentUser();
  const viewerId = viewer?.id ?? null;
  const isOwner = viewerId !== null && viewerId === target.id;
  if (viewerId && (await isBlockedEither(viewerId, target.id))) {
    return <Unavailable />;
  }

  const includePrivate = isOwner;
  const [tags, stats, likes, peopleIBack, publicActivity, backingStories, identityAwards] =
    await Promise.all([
      getInterestTags(target.id, includePrivate),
      getIdentityStats(target.id, includePrivate),
      isOwner
        ? likedItemsForUser(target.id)
        : likedPublicItemsForUser(target.id),
      getPeopleIBack(viewerId, target.id),
      hasPublicActivity(target.id),
      // Phase 5.3: My Backing Stories — viewer-gated inside
      // getBackingStories (owner sees all, others see effective-public
      // moments only). Fully-private profiles never reach this branch.
      getBackingStories(viewerId, target.id),
      // Phase 5.7: evidence-based identities — viewer-gated below
      // (owner + public viewers; fully-private profiles: owner only).
      getIdentityAwards(target.id),
    ]);

  // Phase 5.7: identity badges render for the owner always and for
  // other viewers only when the user has public activity. Summaries
  // are counts-only — no names, dates, or reasons ever leave here.
  const visibleIdentities = visibleIdentityAwards(
    identityAwards,
    isOwner,
    publicActivity
  );

  // Taste Match: logged-in viewer, someone else's profile, gates pass.
  const tasteMatch =
    viewerId && !isOwner ? await getTasteMatch(viewerId, target.id) : null;

  // Phase 5.4: THEIR REPHEAR JOURNEY — for claimed nominees this user
  // owns, the nominee's public milestone trail. The timeline is the
  // nominee's public facts; the YOU JOINED HERE marker is strictly the
  // viewer's own first moment (never another user's). On a
  // fully-private profile, other viewers see the trail but no marker.
  const claimedProfiles = await findProfilesClaimedByUser(target.id);
  const journeys = (
    await Promise.all(
      claimedProfiles.map(async (profile) => {
        const [entries, ranking] = await Promise.all([
          getJourneyTimeline(profile.rankingId, profile.id),
          findRankingById(profile.rankingId),
        ]);
        if (entries.length === 0 || !ranking) return null;
        const marker =
          viewerId && (isOwner || publicActivity)
            ? await getViewerJoinMarker(viewerId, profile.rankingId, profile.id)
            : null;
        return {
          profile,
          rankingTitle: ranking.title,
          entries,
          marker,
        };
      })
    )
  ).filter((j): j is NonNullable<typeof j> => j !== null);

  // Recognition: "Backed {name} before they reached the Top 10" — the
  // early-backer set (judgement, never spend).
  const earlyBacked = peopleIBack.filter(
    (r) =>
      r.rankAtFirstSupport != null &&
      r.rankAtFirstSupport > 10 &&
      r.currentRank != null &&
      r.currentRank <= 10
  );

  const fullyPrivate = !isOwner && !publicActivity;
  const viewerBlocked = viewerId
    ? await isBlocked(viewerId, target.id)
    : false;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Identity header */}
      <div className="flex items-center gap-4">
        <Avatar name={target.name} size={64} />
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            {target.name}
          </h1>
          {target.location && (
            <p className="text-xs uppercase tracking-wide text-subtle">
              {target.location}
            </p>
          )}
        </div>
        {/* Phase 3: notification bell (global header is owned by the
            in-flight homepage redesign; mounted here + /rankings for now). */}
        {isOwner && <NotificationBell />}
      </div>

      {tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="rounded-full border border-border px-2.5 py-1 text-xs text-subtle"
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {viewerId && !isOwner && (
        <ProfileReportBlock
          targetUserId={target.id}
          targetName={target.name}
          initialBlocked={viewerBlocked}
        />
      )}

      {fullyPrivate ? (
        <>
          <p className="mt-8 text-sm text-subtle">
            This user keeps their activity private.
          </p>
          {/* Phase 5.4: the milestone trail is the NOMINEE's public
              facts, so it stays visible even here — but never with a
              per-user marker. */}
          {journeys.map((j) => (
            <JourneyTimeline
              key={`j:${j.profile.rankingId}:${j.profile.id}`}
              nomineeName={j.profile.name}
              rankingTitle={j.rankingTitle}
              rankingId={j.profile.rankingId}
              profileId={j.profile.id}
              entries={j.entries}
              marker={null}
            />
          ))}
        </>
      ) : (
        <>
          {/* Identity stats — any chip with a 0 count is hidden */}
          {(stats.backedCreators > 0 ||
            stats.earlyBacker > 0 ||
            stats.reachedTop10 > 0) && (
            <div className="mt-6 flex flex-wrap gap-2">
              {stats.backedCreators > 0 && (
                <StatChip label={`Backed ${stats.backedCreators} creators`} />
              )}
              {stats.earlyBacker > 0 && (
                <StatChip label={`Early Backer ×${stats.earlyBacker}`} />
              )}
              {stats.reachedTop10 > 0 && (
                <StatChip
                  label={`${stats.reachedTop10} ${stats.reachedTop10 === 1 ? "person" : "people"} I backed reached Top 10`}
                />
              )}
            </div>
          )}

          {/* Phase 5.7: evidence-based identities — viewer-gated above
              (owner + public viewers). Summaries are counts-only. */}
          <IdentityBadges awards={visibleIdentities} isOwner={isOwner} />

          <PeopleIBackSection rows={peopleIBack} targetUserId={target.id} />

          <BackingStoriesSection stories={backingStories} isOwner={isOwner} />

          {/* Phase 5.6: My Story Cards — owner only. Never rendered for
              anyone else; card URLs never enumerate. */}
          {isOwner && <StoryCardsPanel userId={target.id} />}

          {/* Phase 5.4: THEIR REPHEAR JOURNEY — claimed nominees' public
              milestone trails, with the viewer's own YOU JOINED HERE
              marker overlaid. */}
          {journeys.map((j) => (
            <JourneyTimeline
              key={`j:${j.profile.rankingId}:${j.profile.id}`}
              nomineeName={j.profile.name}
              rankingTitle={j.rankingTitle}
              rankingId={j.profile.rankingId}
              profileId={j.profile.id}
              entries={j.entries}
              marker={j.marker}
            />
          ))}

          {/* Public Likes */}
          {likes.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-subtle">
                Likes
              </h2>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {likes.map((like) => (
                  <li key={`${like.rankingId}:${like.profileId}`}>
                    <Link
                      href={`/profiles/${like.profileId}`}
                      className="flex items-center gap-2.5 rounded-xl border border-border px-3 py-2.5 hover:border-ink"
                    >
                      <Avatar
                        name={like.profileName}
                        photoUrl={like.profilePhotoUrl ?? undefined}
                        size={36}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-ink">
                          {like.profileName}
                        </p>
                        <p className="truncate text-[11px] text-subtle">
                          {like.rankingTitle}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Recognition */}
          {earlyBacked.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-subtle">
                Recognition
              </h2>
              <ul className="flex flex-col gap-2">
                {earlyBacked.map((row) => (
                  <li
                    key={`rec:${row.rankingId}:${row.profileId}`}
                    className="rounded-xl border border-border px-4 py-3 text-sm text-subtle"
                  >
                    Backed{" "}
                    <Link
                      href={`/profiles/${row.profileId}`}
                      className="font-medium text-ink hover:underline"
                    >
                      {row.profileName}
                    </Link>{" "}
                    before they reached the Top 10
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tasteMatch && (
            <TasteMatchPanel match={tasteMatch} targetName={target.name} />
          )}
        </>
      )}
    </div>
  );
}

function StatChip({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-ink">
      {label}
    </span>
  );
}
