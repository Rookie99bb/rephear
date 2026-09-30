"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Phase 3 (§16): notification bell. Polls the unread count, shows a
// dropdown with the latest notifications, marks them read on open.
// Logged-out visitors see nothing (the unread-count endpoint returns 0
// and the bell stays hidden).
//
// NOTE: mounted on /u/[id] and /rankings for now. Once the
// feature/homepage-redesign branch lands (it owns the global
// SiteHeader), this bell should move into the global header so it
// appears on every page.

interface BellNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export default function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<BellNotification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/notifications/unread-count", {
          credentials: "same-origin",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { unread?: number };
        if (!cancelled && typeof data.unread === "number") {
          setUnread(data.unread);
          setLoaded(true);
        }
      } catch {
        // Bell is non-critical; stay silent on network errors.
      }
    }
    poll();
    const timer = setInterval(poll, 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open ]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      try {
        const res = await fetch("/api/notifications?limit=8", {
          credentials: "same-origin",
        });
        if (res.ok) {
          const data = (await res.json()) as {
            notifications?: BellNotification[];
            unread?: number;
          };
          setItems(data.notifications ?? []);
          if (typeof data.unread === "number") setUnread(data.unread);
        }
      } catch {
        // Non-critical; the full center page is one click away.
      }
      // Mark all read once the user has seen the panel.
      try {
        await fetch("/api/notifications/read", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ all: true }),
        });
        setUnread(0);
      } catch {
        // Non-critical.
      }
    }
  }

  // Never unmount while the panel is open: opening marks everything
  // read (setUnread(0)), which must not collapse the panel the user is
  // looking at.
  if (!loaded) return null;

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={toggle}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
        className="relative rounded-full p-2 text-lg leading-none hover:bg-black/5"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold">Notifications</span>
            <Link
              href="/notifications"
              className="text-xs text-blue-600 hover:underline"
              onClick={() => setOpen(false)}
            >
              View all
            </Link>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-subtle">
              You&apos;re all caught up.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  {n.link ? (
                    <Link
                      href={n.link}
                      className="block px-4 py-3 hover:bg-black/[0.03]"
                      onClick={() => setOpen(false)}
                    >
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="mt-0.5 text-xs text-subtle">{n.body}</p>
                    </Link>
                  ) : (
                    <div className="px-4 py-3">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="mt-0.5 text-xs text-subtle">{n.body}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
