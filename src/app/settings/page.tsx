import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentFullUser } from "@/lib/session";
import { submitLocationAction } from "@/lib/actions/users";
import { LOCATIONS } from "@/lib/locations";
import { likedItemsForUser, type LikedItem } from "@/db/likes";
import {
  supportedItemsForUser,
  type SupportedItem,
} from "@/db/creditTransactions";

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

  const [liked, supported] = await Promise.all([
    likedItemsForUser(user.id),
    supportedItemsForUser(user.id),
  ]);

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
