import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentFullUser } from "@/lib/session";
import {
  submitLocationAction,
  submitVisibilityAction,
} from "@/lib/actions/users";
import { LOCATIONS } from "@/lib/locations";
import { likedItemsForUser, type LikedItem } from "@/db/likes";
import {
  supportedItemsForUser,
  type SupportedItem,
} from "@/db/creditTransactions";
import { getOrCreateInvitationForUser } from "@/db/invitations";
import { getSiteUrl } from "@/lib/siteUrl";
import InviteLinkCard from "@/components/InviteLinkCard";

function ActivityList<T extends { rankingId: string; profileId: string }>({
  items,
  emptyText,
  renderItem,
}: {
  items: T[];
  emptyText: string;
  renderItem: (item: T) => React.ReactNode;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-subtle">{emptyText}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li
          key={`${item.rankingId}-${item.profileId}`}
          className="rounded-lg border border-border px-4 py-3 text-sm"
        >
          {renderItem(item)}
        </li>
      ))}
    </ul>
  );
}

export default async function SettingsPage() {
  const user = await getCurrentFullUser();
  if (!user) redirect("/login");

  const [liked, supported, invitation] = await Promise.all([
    likedItemsForUser(user.id),
    supportedItemsForUser(user.id),
    getOrCreateInvitationForUser(user.id),
  ]);
  const inviteUrl = `${getSiteUrl()}/invite/${invitation.inviteCode}`;

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-xl font-semibold tracking-tight text-ink">
        Settings
      </h1>

      <div className="mt-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-subtle">
          Location
        </h2>
        <p className="mb-3 text-sm text-subtle">
          Rankings and the homepage are filtered to your location by
          default.
          {user.location && (
            <>
              {" "}
              Currently: <span className="font-medium text-ink">{user.location}</span>.
            </>
          )}
        </p>
        <form
          action={submitLocationAction}
          className="flex flex-wrap gap-2"
        >
          {LOCATIONS.map((location) => (
            <button
              key={location}
              type="submit"
              name="location"
              value={location}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                user.location === location
                  ? "border-ink bg-ink text-white"
                  : "border-border text-ink hover:border-ink"
              }`}
            >
              {location}
            </button>
          ))}
        </form>
      </div>

      <div className="mt-10">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-subtle">
          Privacy
        </h2>
        <p className="mb-3 text-sm text-subtle">
          Who can see your Likes and Supports. Private is control, not
          status — a private Like or Support still counts fully toward the
          ranking; it only stays in your own history.
        </p>
        <form action={submitVisibilityAction} className="flex flex-col gap-4">
          {(
            [
              {
                name: "showLikes" as const,
                label: "My Likes",
                current: user.showLikes,
                publicText: "Public — my Likes may appear on my public profile",
                privateText: "Private — my Likes stay in my history only",
              },
              {
                name: "showSupports" as const,
                label: "My Supports",
                current: user.showSupports,
                publicText:
                  "Public — pre-check “Show that I back them” at checkout",
                privateText: "Private — pre-check “Keep this Support private”",
              },
            ]
          ).map((field) => (
            <div key={field.name}>
              <p className="mb-1 text-sm font-medium text-ink">{field.label}</p>
              <div className="flex flex-col gap-2">
                {(
                  [
                    { value: "public", text: field.publicText },
                    { value: "private", text: field.privateText },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                      field.current === opt.value
                        ? "border-ink bg-surface font-medium text-ink"
                        : "border-border text-subtle hover:border-ink"
                    }`}
                  >
                    <input
                      type="radio"
                      name={field.name}
                      value={opt.value}
                      defaultChecked={field.current === opt.value}
                      className="accent-pink-600"
                    />
                    {opt.text}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button
            type="submit"
            className="w-fit rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            Save privacy settings
          </button>
        </form>
      </div>

      <div className="mt-10">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-subtle">
          Invite Friends
        </h2>
        <p className="mb-3 text-sm text-subtle">
          Recognition belongs to everyone. Invite people who believe that
          too — you both get a few more Likes to recognise others.
        </p>
        <InviteLinkCard
          inviteUrl={inviteUrl}
          totalVisits={invitation.totalVisits}
          successfulInvites={invitation.successfulInvites}
          inviteBonusLikes={user.inviteBonusLikes}
        />
      </div>

      <div className="mt-10">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-subtle">
          Rankings You&apos;ve Liked
        </h2>
        <p className="mb-3 text-sm text-subtle">
          Nominees you&apos;ve liked, across every Ranking.
        </p>
        <ActivityList<LikedItem>
          items={liked}
          emptyText="You haven't liked anyone yet."
          renderItem={(item) => (
            <>
              <Link
                href={`/rankings/${item.rankingId}`}
                className="font-medium text-ink hover:underline"
              >
                {item.profileName}
              </Link>
              <span className="text-subtle"> in {item.rankingTitle}</span>
              {item.count > 1 && (
                <span className="ml-2 text-xs text-subtle">
                  ×{item.count}
                </span>
              )}
            </>
          )}
        />
      </div>

      <div className="mt-10">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-subtle">
          Rankings You&apos;ve Supported
        </h2>
        <p className="mb-3 text-sm text-subtle">
          Nominees you&apos;ve backed with Reputation Credits.
        </p>
        <ActivityList<SupportedItem>
          items={supported}
          emptyText="You haven't supported anyone yet."
          renderItem={(item) => (
            <>
              <Link
                href={`/rankings/${item.rankingId}`}
                className="font-medium text-ink hover:underline"
              >
                {item.profileName}
              </Link>
              <span className="text-subtle"> in {item.rankingTitle}</span>
              <span className="ml-2 text-xs text-subtle">
                {item.totalCredits} credits
              </span>
            </>
          )}
        />
      </div>
    </div>
  );
}
