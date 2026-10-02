import Link from "next/link";
import Avatar from "@/components/Avatar";
import RankingCover from "./RankingCover";
import { compact } from "./format";
import type { CloseBattle } from "@/db/homepage";
import type { Ranking } from "@/lib/types";

export interface RisingItem {
  ranking: Ranking;
  likes7d: number;
  credits7d: number;
  // Organic likes in the 7 days before the current window — feeds the
  // optional "↑ XX% this week" badge. Zero → badge omitted.
  likesPrev7d: number;
  thumbPhotoUrl: string;
  thumbName: string;
  thumbColor: string;
}

// Rising Now data always flows through the RisingItem list above — cold-start
// seed (when enabled) is already folded into each item's likes7d by the
// server (see src/config/risingColdStart.ts). No demo/fake rows exist here.

// Three-column activity row: Close Battles · Rising Now · Upcoming Events.
// Modules with no honest data render nothing (never faked).
export default function ActivityGrid({
  battle,
  rising,
  eventHrefs = {},
}: {
  battle: CloseBattle | null;
  rising: RisingItem[];
  // Resolved public ranking deep-links for event-adjacent rankings,
  // keyed by ranking slug. Events without a resolved link stay unlinked.
  eventHrefs?: Record<string, string>;
}) {
  const showRising = rising.length > 0;
  if (!battle && !showRising) return null;
  const moduleCount = (battle ? 1 : 0) + (showRising ? 1 : 0) + 1; // +1 for Upcoming Events
  const gridCols =
    moduleCount >= 3 ? "md:grid-cols-3" : moduleCount === 2 ? "md:grid-cols-2" : "";
  return (
    <div className={`grid grid-cols-1 gap-6 ${gridCols}`}>
      {battle && <CloseBattles battle={battle} />}
      {showRising && <RisingNow items={rising} />}
      <UpcomingEvents eventHrefs={eventHrefs} />
    </div>
  );
}

function ModuleHeader({
  icon,
  title,
  subtitle,
  viewAllHref,
}: {
  icon: string;
  title: string;
  subtitle: string;
  viewAllHref?: string;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-1.5 text-[19px] font-bold tracking-tight text-ink">
          <span aria-hidden="true">{icon}</span> {title}
        </h2>
        <p className="mt-0.5 text-[13px] text-subtle">{subtitle}</p>
      </div>
      {viewAllHref && (
        <Link
          href={viewAllHref}
          className="mt-1 shrink-0 text-[13px] font-medium text-ink hover:text-brand-ink"
        >
          View all <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];

function CloseBattles({ battle }: { battle: CloseBattle }) {
  return (
    <section aria-label="Close battles">
      <ModuleHeader
        icon="⚔️"
        title="Close Battles"
        subtitle="Only a few likes separate the top nominees."
        viewAllHref={`/rankings/${battle.ranking.id}`}
      />
      <div className="rounded-2xl border border-border bg-white p-4">
        <ul className="divide-y divide-border/70">
          {battle.top.map((profile, i) => (
            <li key={profile.id} className="flex items-center gap-3 py-3 first:pt-1 last:pb-1">
              <span className="w-7 text-center text-xl" aria-hidden="true">
                {MEDALS[i] ?? `${i + 1}`}
              </span>
              <Avatar
                name={profile.name}
                photoUrl={profile.photoUrl || undefined}
                size={44}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-ink">
                  {profile.name}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-[15px] font-bold text-ink">
                  ❤️ {battle.credits[i].toLocaleString("en-GB")}
                </span>
                <span className="block text-xs text-subtle">Support Credits</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 border-t border-border/70 pt-3 text-center text-[13px] font-medium text-subtle">
          📊 Only {battle.gap.toLocaleString("en-GB")} Credits separate #1 and
          #2!
        </p>
      </div>
    </section>
  );
}

// Compact, dense momentum list: ~72–88px rows, each with a small
// ranking thumb, title, real "🔥 X likes this week" and an optional
// "↑ XX%" week-over-week badge (organic likes only — shown only when the
// previous week had a non-zero baseline, so the percentage is honest).
function RisingNow({ items }: { items: RisingItem[] }) {
  return (
    <section aria-label="Rising now">
      <ModuleHeader
        icon="🚀"
        title="Rising Now"
        subtitle="These rankings and nominees are climbing fast."
        viewAllHref="/rankings"
      />
      <ul className="flex flex-col gap-2.5">
        {items.map((item) => {
          const showLikes = item.likes7d >= item.credits7d;
          const pct =
            showLikes && item.likesPrev7d > 0
              ? Math.round(
                  ((item.likes7d - item.likesPrev7d) / item.likesPrev7d) *
                    100
                )
              : null;
          return (
            <li key={item.ranking.id}>
              <RisingRow
                href={`/rankings/${item.ranking.id}`}
                title={item.ranking.title}
                likesLine={
                  showLikes
                    ? `🔥 ${compact(item.likes7d)} likes this week`
                    : `🔥 ${compact(item.credits7d)} support credits this week`
                }
                pctLabel={pct !== null ? `${pct}%` : null}
                thumb={
                  <span className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                    <RankingCover
                      photoUrl={item.thumbPhotoUrl}
                      nomineeName={item.thumbName}
                      avatarColor={item.thumbColor}
                      rankingTitle={item.ranking.title}
                      variant="thumb"
                    />
                  </span>
                }
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RisingRow({
  href,
  title,
  likesLine,
  pctLabel,
  thumb,
}: {
  href: string;
  title: string;
  likesLine: string;
  pctLabel: string | null;
  thumb: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-[76px] items-center gap-3 rounded-2xl border border-border bg-white p-3 transition hover:border-brand/50"
    >
      {thumb}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-ink group-hover:text-brand-ink">
          {title}
        </span>
        <span className="mt-0.5 block text-[13px] font-medium text-emerald-600">
          {likesLine}
        </span>
      </span>
      {pctLabel && (
        <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
          ↑ {pctLabel}
        </span>
      )}
    </Link>
  );
}

// Curated-static event list. There is NO events table in the data model,
// so these are hand-verified real upcoming events (verified 2026-09-30),
// not derived data. Do not invent events or dates here — when an events
// table exists, replace this block with a real query.
const UPCOMING_EVENTS: {
  name: string;
  date: string;
  venue: string;
  // Ranking slug whose public page this event may link to (resolved via
  // eventHrefs). null → never linked; no dead links are invented.
  hrefSlug: string | null;
  featured?: boolean;
}[] = [
  {
    name: "MCM London 2026",
    date: "23–25 Oct 2026",
    venue: "ExCeL London",
    hrefSlug: null, // no MCM ranking exists — plain card, no dead link
    featured: true,
  },
  {
    name: "AnimeCon London 2026",
    date: "3–4 Oct 2026",
    venue: "Olympia London",
    // Resolved at render time from the ranking slug (public-only);
    // absent → the card stays unlinked.
    hrefSlug: "cosplayers-to-watch-at-animecon-london-2026",
  },
  {
    name: "Japan Matsuri 2026",
    date: "4 Oct 2026",
    venue: "London",
    hrefSlug: null,
  },
  {
    name: "Noli TCG Card Show",
    date: "3 Oct 2026",
    venue: "London",
    hrefSlug: "tcg-traders-to-meet-at-noli-tcg-card-show",
  },
  {
    name: "Dragonmeet 2026",
    date: "28 Nov 2026",
    venue: "London",
    hrefSlug: null,
  },
];

export function UpcomingEvents({ eventHrefs }: { eventHrefs: Record<string, string> }) {
  const withHrefs = UPCOMING_EVENTS.map((event) => ({
    ...event,
    href: event.hrefSlug ? eventHrefs[event.hrefSlug] ?? null : null,
  }));
  const [featured, ...rest] = withHrefs;
  const small = rest.slice(0, 3);
  const extra = rest.slice(3);
  return (
    <section aria-label="Upcoming events">
      <ModuleHeader
        icon="🗓️"
        title="Upcoming Events"
        subtitle="Be part of the next big rankings."
      />
      <EventCard event={featured} featured />
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {small.map((event) => (
          <EventCard key={event.name} event={event} />
        ))}
      </div>
      {extra.map((event) => (
        <div
          key={event.name}
          className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-border bg-white px-3 py-2.5"
        >
          <span className="truncate text-[13px] font-semibold text-ink">
            {event.name}
          </span>
          <span className="shrink-0 text-xs text-subtle">{event.date}</span>
        </div>
      ))}
    </section>
  );
}

function EventCard({
  event,
  featured = false,
}: {
  event: Omit<(typeof UPCOMING_EVENTS)[number], "hrefSlug"> & {
    href: string | null;
  };
  featured?: boolean;
}) {
  const inner = featured ? (
    <div className="relative overflow-hidden rounded-2xl bg-ink p-4 text-white">
      <div
        aria-hidden="true"
        className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-brand/30 blur-2xl"
      />
      <div className="relative flex items-start justify-between gap-2">
        <span className="rounded-lg bg-black px-2.5 py-1.5 text-[11px] font-extrabold leading-tight tracking-wide ring-1 ring-white/25">
          MCM
          <br />
          COMIC CON
          <br />
          LONDON
        </span>
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #7B4DFF, #4285F4)" }}
        >
          Live soon
        </span>
      </div>
      <p className="relative mt-3 text-[15px] font-bold">{event.name}</p>
      <p className="relative mt-1 text-xs text-white/70">📅 {event.date}</p>
      <p className="relative text-xs text-white/70">📍 {event.venue}</p>
    </div>
  ) : (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      <div
        aria-hidden="true"
        className="flex h-16 items-center justify-center text-center"
        style={{ background: "linear-gradient(135deg, #7B4DFF, #4285F4)" }}
      >
        <span className="px-1 text-[11px] font-bold leading-tight text-white">
          {event.date}
        </span>
      </div>
      <div className="p-2">
        <p className="text-xs font-bold leading-tight text-ink">{event.name}</p>
        <p className="mt-0.5 text-[11px] text-subtle">{event.venue}</p>
      </div>
    </div>
  );
  return event.href ? (
    <Link href={event.href} className="block">
      {inner}
    </Link>
  ) : (
    <div>{inner}</div>
  );
}
