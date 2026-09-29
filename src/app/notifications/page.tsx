import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listNotifications } from "@/db/notifications";
import MarkAllReadButton from "@/components/MarkAllReadButton";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Your RepHear milestone notifications.",
};

// Phase 3 (§16): in-app notification center. Milestone-only, newest
// first. Each row deep-links to the ranking where the milestone
// happened.
export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/signin");

  const notifications = await listNotifications(user.id, 50);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        {notifications.some((n) => !n.readAt) && <MarkAllReadButton />}
      </div>
      {notifications.length === 0 ? (
        <div className="rounded-xl border border-border p-10 text-center">
          <p className="text-4xl">🔔</p>
          <p className="mt-3 font-medium">Nothing yet</p>
          <p className="mt-1 text-sm text-subtle">
            When someone you backed hits a milestone — or a ranking you
            follow heats up — you&apos;ll hear about it here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`rounded-xl border p-4 ${
                n.readAt ? "border-border" : "border-blue-300 bg-blue-50/50"
              }`}
            >
              <p className="font-medium">{n.title}</p>
              <p className="mt-1 text-sm text-subtle">{n.body}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-subtle">
                  {new Date(n.createdAt).toLocaleString()}
                </span>
                {n.link && (
                  <Link
                    href={n.link}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    View →
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
