import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { findUserById } from "@/db/users";
import { isBlocked, isBlockedEither } from "@/db/userReports";
import { likedItemsForUser, likedPublicItemsForUser } from "@/db/likes";
import {
  getInterestTags,
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
import ProfileReportBlock from "@/components/ProfileReportBlock";
import NotificationBell from "@/components/NotificationBell";
import { listUserEventConversations } from "@/db/eventMessages";
import { findEventPerson, findSocialEventById } from "@/db/events";
import BackerPassport from "@/components/BackerPassport";
import BackerCheckInButton from "@/components/BackerCheckInButton";
import {
  calculateBackerGrowth,
  getOrAssignDailyQuest,
  getOrAssignCreatorQuest,
  getPrimaryCommunity,
  getRecognitionSummary,
  listEarnedBadges,
  listEarnedRewards,
} from "@/db/communityGrowth";
import { IDENTITY_RULES } from "@/lib/identityConfig";
import CreatorQuestPanel from "@/components/CreatorQuestPanel";

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
  searchParams,
}: {
  params: { id: string };
  searchParams: { eventPerson?: string };
}): Promise<Metadata> {
  const target = await findUserById(params.id);
  if (!target || target.isHidden) {
    return { title: "Profile unavailable" };
  }
  const eventIdentity = searchParams.eventPerson
    ? await findEventPerson(searchParams.eventPerson)
    : null;
  const publicName = eventIdentity?.userId === target.id
    ? eventIdentity.displayName
    : target.name;
  return { title: `${publicName} on RepHear` };
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
  searchParams,
}: {
  params: { id: string };
  searchParams: { eventPerson?: string };
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

  // Event cards are public personas owned by an account. When someone
  // follows an event-card link into the wider RepHear profile, preserve
  // that public identity instead of unexpectedly exposing the account name
  // imported from Google. The ownership check prevents one user's card from
  // being injected into another user's profile URL.
  const requestedEventIdentity = searchParams.eventPerson
    ? await findEventPerson(searchParams.eventPerson, viewerId)
    : null;
  const eventIdentity = requestedEventIdentity?.userId === target.id
    ? requestedEventIdentity
    : null;
  const identityEvent = eventIdentity
    ? await findSocialEventById(eventIdentity.eventId)
    : null;
  const publicName = eventIdentity?.displayName ?? target.name;
  const publicPhotoUrl = eventIdentity?.photoUrl || undefined;

  const includePrivate = isOwner;
  const [tags, likes, peopleIBack, publicActivity, backingStories, identityAwards, conversations] =
    await Promise.all([
      getInterestTags(target.id, includePrivate),
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
      isOwner ? listUserEventConversations(target.id) : Promise.resolve([]),
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
  const creatorQuest = isOwner && claimedProfiles.length > 0
    ? await getOrAssignCreatorQuest(target.id)
    : null;

  const fullyPrivate = !isOwner && !publicActivity;
  const viewerBlocked = viewerId
    ? await isBlocked(viewerId, target.id)
    : false;
  const [growth, earnedBadges, earnedRewards, dailyQuest, recognition, primaryCommunity] =
    fullyPrivate
      ? [null, [], [], null, null, null]
      : await Promise.all([
          calculateBackerGrowth(target.id, isOwner),
          listEarnedBadges(target.id),
          listEarnedRewards(target.id),
          isOwner ? getOrAssignDailyQuest(target.id) : Promise.resolve(null),
          getRecognitionSummary(target.id),
          getPrimaryCommunity(target.id),
        ]);

  const passportBadges = [
    ...earnedBadges.map((badge) => ({
      id: badge.id,
      name: badge.name,
      description: badge.description,
      earnedAt: new Date(badge.awardedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      permanent: badge.permanent,
      icon: "✦",
    })),
    ...visibleIdentities.map((award) => ({
      id: award.id,
      name: IDENTITY_RULES[award.identityKey].name,
      description: award.evidenceSummary,
      earnedAt: new Date(award.awardedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      permanent: true,
      icon: IDENTITY_RULES[award.identityKey].emoji,
    })),
    ...earnedRewards.map((reward) => ({
      id: reward.id,
      name: reward.name,
      description: reward.description,
      earnedAt: new Date(reward.grantedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      permanent: reward.kind === "earned_reward",
      icon: reward.kind === "elected_role" ? "♛" : "◇",
    })),
  ];

  return (
    <div className="mx-auto max-w-5xl">
      {/* Identity header */}
      <div className="flex items-center gap-4">
        <Avatar name={publicName} photoUrl={publicPhotoUrl} size={64} />
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            {publicName}
          </h1>
          {eventIdentity ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-ink">
              {identityEvent ? `${identityEvent.title} identity` : "Event identity"}
            </p>
          ) : target.location && (
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
          targetName={publicName}
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
          {growth && recognition && (
            <BackerPassport
              passport={{
                name: publicName,
                photoUrl: publicPhotoUrl,
                location: target.location,
                bio: eventIdentity?.sayHi || null,
                level: growth.levelLabel,
                primaryCommunity: primaryCommunity?.name ?? tags[0]?.name ?? null,
                communityRole: primaryCommunity?.role ?? null,
                record: {
                  currentStreak: growth.currentStreak,
                  longestStreak: growth.longestStreak,
                  lifetimeActiveDays: growth.lifetimeActiveDays,
                  votes: growth.votes,
                  supportCredits: growth.supportCredits,
                  successfulInvites: growth.successfulInvites,
                },
                today: {
                  checkedIn: growth.checkedInToday,
                  questTitle: dailyQuest?.title ?? null,
                  questDescription: dailyQuest?.description ?? null,
                  questCompleted: dailyQuest?.completed ?? false,
                  questHref: "/rankings",
                },
                badges: passportBadges,
                recognition,
                community: primaryCommunity ? {
                  name: primaryCommunity.name,
                  href: `/rankings?category=${encodeURIComponent(primaryCommunity.slug)}`,
                  role: primaryCommunity.role,
                  goalName: primaryCommunity.goalName,
                  goalProgress: primaryCommunity.goalProgress,
                  goalTarget: primaryCommunity.goalTarget,
                  memberContribution: primaryCommunity.memberContribution,
                } : null,
              }}
              checkInControl={isOwner ? <BackerCheckInButton /> : null}
              backing={<PeopleIBackSection rows={peopleIBack} targetUserId={target.id} embedded />}
            />
          )}
          {creatorQuest && (
            <CreatorQuestPanel
              title={creatorQuest.title}
              description={creatorQuest.description}
              completed={creatorQuest.completed}
            />
          )}

          {isOwner && (
            <section className="mt-8">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-subtle">
                    Messages
                  </h2>
                  <p className="mt-1 text-xs text-subtle">Messages from your mutual event connections.</p>
                </div>
              </div>
              {conversations.length > 0 ? (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {conversations.map((conversation) => (
                    <li key={conversation.id}>
                      <Link
                        href={`/events/${conversation.eventSlug}/messages/${conversation.id}`}
                        className="flex h-full items-center gap-3 rounded-xl border border-border bg-white p-3 transition hover:border-brand-ink"
                      >
                        <Avatar
                          name={conversation.otherName}
                          photoUrl={conversation.otherPhotoUrl || undefined}
                          size={44}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-ink">{conversation.otherName}</p>
                            {conversation.lastSenderUserId !== target.id && conversation.lastMessage && (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-brand-ink" aria-label="Latest message received" />
                            )}
                          </div>
                          <p className="truncate text-[11px] font-medium uppercase tracking-wide text-brand-ink">
                            {conversation.eventTitle}
                          </p>
                          <p className="mt-1 truncate text-xs text-subtle">
                            {conversation.lastMessage || "Open this connection"}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-subtle">
                  No messages yet. Mutual event connections can start a private chat with you.
                </div>
              )}
            </section>
          )}

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

          {tasteMatch && (
            <TasteMatchPanel match={tasteMatch} targetName={target.name} />
          )}
        </>
      )}
    </div>
  );
}
