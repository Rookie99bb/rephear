import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentFullUser } from "@/lib/session";
import { formatCents } from "@/lib/redemption";
import { listPayoutsForUser } from "@/db/referrerCommissions";
import type { ReferralPayoutStatus } from "@/lib/types";

const STATUS_STYLES: Record<ReferralPayoutStatus, string> = {
  requested: "bg-amber-100 text-amber-900",
  approved: "bg-sky-100 text-sky-800",
  paid: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-700",
};

const STATUS_HELP: Record<ReferralPayoutStatus, string> = {
  requested: "Under review — we send payouts manually once a month.",
  approved: "Approved — on the way in the next payout batch.",
  paid: "Sent. Check the contact you provided.",
  rejected: "Not approved — see the note, then request again when eligible.",
};

function formatDate(iso: string): string {
  return new Date(iso.replace(" ", "T") + "Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function PayoutsPage() {
  const user = await getCurrentFullUser();
  if (!user) redirect("/login");

  const payouts = await listPayoutsForUser(user.id);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/referrals"
        className="text-xs font-medium text-subtle hover:text-ink"
      >
        ← Referral Hub
      </Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight text-ink">
        Withdrawal history
      </h1>

      {payouts.length === 0 ? (
        <p className="mt-6 text-sm text-subtle">
          No withdrawal requests yet.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {payouts.map((p) => (
            <li key={p.id} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {formatCents(p.amountCents)} {p.currency}
                  </p>
                  <p className="mt-1 text-xs text-subtle">
                    Requested {formatDate(p.requestedAt)}
                    {p.reviewedAt && ` · reviewed ${formatDate(p.reviewedAt)}`}
                  </p>
                  <p className="mt-0.5 text-xs text-subtle">
                    {STATUS_HELP[p.status]}
                  </p>
                  {p.adminNotes && (
                    <p className="mt-1 text-xs text-subtle">
                      Note: {p.adminNotes}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[p.status]}`}
                >
                  {p.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
