import Link from "next/link";
import type { ReactNode } from "react";
import Avatar from "@/components/Avatar";

export interface BackerBadgeViewModel {
  id: string;
  name: string;
  description: string;
  earnedAt?: string | null;
  icon?: string;
  permanent?: boolean;
}

export interface BackerRecognitionViewModel {
  peopleRecognized: number;
  recognizedBy: number;
  mutualRecognitions: number;
}

export interface BackerCommunityViewModel {
  name: string;
  href?: string;
  role?: string | null;
  goalName?: string | null;
  goalProgress?: number | null;
  goalTarget?: number | null;
  memberContribution?: number | null;
}

export interface BackerPassportViewModel {
  name: string;
  photoUrl?: string | null;
  location?: string | null;
  bio?: string | null;
  level: string;
  primaryCommunity?: string | null;
  communityRole?: string | null;
  record: {
    currentStreak: number;
    longestStreak?: number | null;
    lifetimeActiveDays: number;
    votes: number;
    supportCredits: number;
    successfulInvites: number;
  };
  today: {
    checkedIn: boolean;
    checkInHref?: string | null;
    questTitle?: string | null;
    questDescription?: string | null;
    questCompleted?: boolean;
    questHref?: string | null;
  };
  badges: BackerBadgeViewModel[];
  recognition: BackerRecognitionViewModel;
  community?: BackerCommunityViewModel | null;
}

export default function BackerPassport({
  passport,
  backing,
  checkInControl,
}: {
  passport: BackerPassportViewModel;
  backing?: ReactNode;
  checkInControl?: ReactNode;
}) {
  const { record, today, recognition, community } = passport;

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl border border-border bg-white">
        <div className="bg-surface px-5 py-6 sm:px-7">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-ink">
            Backer passport
          </p>
          <div className="mt-4 flex items-start gap-4">
            <Avatar
              name={passport.name}
              photoUrl={passport.photoUrl || undefined}
              size={64}
            />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-bold tracking-tight text-ink">
                {passport.name}
              </h1>
              <div className="mt-2 flex flex-wrap gap-2">
                <MetaPill>{passport.level}</MetaPill>
                {passport.primaryCommunity && (
                  <MetaPill>{passport.primaryCommunity}</MetaPill>
                )}
                {passport.communityRole && (
                  <MetaPill>{passport.communityRole}</MetaPill>
                )}
              </div>
              {passport.location && (
                <p className="mt-3 text-xs uppercase tracking-wide text-subtle">
                  {passport.location}
                </p>
              )}
              {passport.bio && (
                <p className="mt-3 max-w-xl text-sm leading-6 text-subtle">
                  {passport.bio}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <PassportSection eyebrow="Your record" title="Backer Record">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <RecordCell label="Current streak" value={`${record.currentStreak} days`} />
          <RecordCell label="Lifetime active" value={`${record.lifetimeActiveDays} days`} />
          <RecordCell label="Votes" value={record.votes.toLocaleString()} />
          <RecordCell label="Support" value={`${record.supportCredits.toLocaleString()} Credits`} />
          <RecordCell label="Successful invites" value={record.successfulInvites.toLocaleString()} />
          {record.longestStreak != null && (
            <RecordCell label="Longest streak" value={`${record.longestStreak} days`} />
          )}
        </div>
      </PassportSection>

      <PassportSection eyebrow="Today" title="Daily Presence">
        <div className="grid gap-3 sm:grid-cols-2">
          <TodayCard
            kicker="Today"
            title={today.checkedIn ? "I’m Here ✦" : "A small daily moment with your community."}
            description={
              today.checkedIn
                ? `I have been part of the community for ${record.currentStreak} days in a row.`
                : "Take a moment to show up for your community."
            }
            state={today.checkedIn ? "Complete" : "Available"}
            href={!today.checkedIn ? today.checkInHref : null}
            actionLabel="I’m Here ✦"
            footer={!today.checkedIn ? checkInControl : null}
          />
          {today.questTitle ? (
            <TodayCard
              kicker="Daily Quest"
              title={today.questTitle}
              description={today.questDescription || "Complete today’s community action."}
              state={today.questCompleted ? "Complete" : "In progress"}
              href={!today.questCompleted ? today.questHref : null}
              actionLabel="Continue quest"
            />
          ) : (
            <TodayCard
              kicker="Daily Quest"
              title="No quest assigned"
              description="Your next community quest will appear here."
              state="Coming soon"
            />
          )}
        </div>
      </PassportSection>

      <PassportSection eyebrow="Earned over time" title="Badges">
        {passport.badges.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {passport.badges.map((badge) => (
              <li key={badge.id} className="rounded-2xl border border-border p-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-xl" aria-hidden>
                    {badge.icon || "✦"}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{badge.name}</p>
                    <p className="mt-1 text-sm leading-5 text-subtle">{badge.description}</p>
                    {(badge.earnedAt || badge.permanent) && (
                      <p className="mt-2 text-xs font-medium text-brand-ink">
                        {[badge.earnedAt, badge.permanent ? "Permanent" : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>Badges earned from real participation will appear here.</EmptyState>
        )}
      </PassportSection>

      <PassportSection eyebrow="Backing" title="People and stories I back">
        {backing || <EmptyState>Your backing history will appear here.</EmptyState>}
      </PassportSection>

      <PassportSection eyebrow="Community relationships" title="Recognition">
        <div className="grid grid-cols-3 gap-2 text-center">
          <RecordCell label="I recognized" value={recognition.peopleRecognized.toLocaleString()} />
          <RecordCell label="Recognized by" value={recognition.recognizedBy.toLocaleString()} />
          <RecordCell label="Mutual" value={recognition.mutualRecognitions.toLocaleString()} />
        </div>
      </PassportSection>

      <PassportSection eyebrow="Community" title={community?.name || "Your community"}>
        {community ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-subtle">Current role</p>
                <p className="font-semibold text-ink">{community.role || "Member"}</p>
              </div>
              {community.href && (
                <Link href={community.href} className="text-sm font-semibold text-brand-ink hover:underline">
                  View community →
                </Link>
              )}
            </div>
            {community.goalName && (
              <CommunityGoal community={community} />
            )}
          </div>
        ) : (
          <EmptyState>Join a community to contribute to shared goals.</EmptyState>
        )}
      </PassportSection>
    </div>
  );
}

function PassportSection({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-ink">{eyebrow}</p>
      <h2 className="mt-1 text-lg font-bold text-ink">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function MetaPill({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-ink">{children}</span>;
}

function RecordCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface px-3 py-4">
      <p className="text-lg font-bold text-ink sm:text-xl">{value}</p>
      <p className="mt-1 text-[11px] font-medium text-subtle sm:text-xs">{label}</p>
    </div>
  );
}

function TodayCard({ kicker, title, description, state, href, actionLabel, footer }: { kicker: string; title: string; description: string; state: string; href?: string | null; actionLabel?: string; footer?: ReactNode }) {
  return (
    <article className="flex min-h-44 flex-col rounded-2xl border border-border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-ink">{kicker}</p>
        <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium text-subtle">{state}</span>
      </div>
      <h3 className="mt-3 font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-sm leading-5 text-subtle">{description}</p>
      {href && actionLabel && (
        <Link href={href} className="mt-auto pt-4 text-sm font-semibold text-brand-ink hover:underline">
          {actionLabel} →
        </Link>
      )}
      {footer}
    </article>
  );
}

function CommunityGoal({ community }: { community: BackerCommunityViewModel }) {
  const progress = Math.max(0, community.goalProgress ?? 0);
  const target = Math.max(0, community.goalTarget ?? 0);
  const pct = target > 0 ? Math.min(100, Math.round((progress / target) * 100)) : 0;
  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Community Goal</p>
          <p className="mt-1 font-semibold text-ink">{community.goalName}</p>
        </div>
        <p className="text-sm font-semibold text-ink">{progress.toLocaleString()} / {target.toLocaleString()}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface" aria-label={`${pct}% complete`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="h-full rounded-full bg-brand-ink" style={{ width: `${pct}%` }} />
      </div>
      {community.memberContribution != null && (
        <p className="mt-2 text-xs text-subtle">Your verified contribution: {community.memberContribution.toLocaleString()}</p>
      )}
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-subtle">{children}</div>;
}
