import Link from "next/link";
import { findInvitationByCode, incrementInvitationVisits } from "@/db/invitations";
import { findUserById } from "@/db/users";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import Avatar from "@/components/Avatar";

// Landing page for rephear.com/invite/<code>. Read-only render (no
// cookie writes here — Server Components can't set cookies in this
// Next.js version). The actual tracking cookie is set by the
// "Join RepHear" button below, which points at a Route Handler
// (/api/invite/accept) rather than being a plain <Link>, since setting a
// cookie requires a real request/response, not a render.
export default async function InvitePage({
  params,
}: {
  params: { code: string };
}) {
  const viewer = await getCurrentUser();
  // Already a member — no need for the invite landing experience, and
  // this sidesteps any self-referral-by-revisiting-a-link weirdness.
  if (viewer) redirect("/");

  const invitation = await findInvitationByCode(params.code);
  if (!invitation) {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="text-sm text-subtle">
          This invitation link isn&apos;t valid, or has expired.
        </p>
        <Link
          href="/"
          className="mt-2 inline-block text-sm font-medium text-ink underline"
        >
          Explore RepHear
        </Link>
      </div>
    );
  }

  // Visit counter is analytics only (never gates a reward), so a render
  // during a bot/crawler prefetch inflating it slightly is a low-stakes
  // trade-off, not a security or fairness concern.
  await incrementInvitationVisits(invitation.inviteCode);

  const owner = await findUserById(invitation.ownerId);
  const ownerName = owner?.name?.trim() || "A RepHear member";

  return (
    <div className="mx-auto max-w-md text-center">
      <div className="flex flex-col items-center gap-3">
        <Avatar name={ownerName} size={56} />
        <p className="text-2xl font-semibold leading-snug tracking-tight text-ink">
          Recognition belongs to everyone.
        </p>
        <p className="text-sm text-subtle">
          {ownerName} invited you to join RepHear — a community where
          people recognise and support each other publicly.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-3">
        <a
          href={`/api/invite/accept?code=${encodeURIComponent(invitation.inviteCode)}`}
          className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          Join RepHear
        </a>
        <Link
          href="/rankings"
          className="text-sm font-medium text-subtle hover:text-ink"
        >
          Browse without joining
        </Link>
      </div>
    </div>
  );
}
