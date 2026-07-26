import Link from "next/link";
import { listPendingRedemptions } from "@/db/redemptions";
import { getCurrentAdmin } from "@/lib/admin";
import { formatCents } from "@/lib/redemption";
import AdminRedemptionReviewForm from "@/components/AdminRedemptionReviewForm";

export default async function AdminRedemptionsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) return null; // layout-level guard already redirects; this satisfies types.

  const pending = await listPendingRedemptions();

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold tracking-tight text-ink">
        Credit Redemptions
      </h2>
      <p className="mb-6 text-sm text-subtle">
        Claimed profile owners cashing out Support Credits. RepHear keeps a
        20% service fee — the Net column is what the owner should actually
        receive. Marking a request &ldquo;Paid&rdquo; does not move money
        itself; send the payout via Stripe/bank first, then mark it here.
      </p>

      {pending.length === 0 ? (
        <p className="text-sm text-subtle">No pending redemption requests.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {pending.map(({ redemption, profileName, requesterName, requesterEmail }) => (
            <li key={redemption.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink">
                    <Link
                      href={`/profiles/${redemption.profileId}`}
                      className="hover:underline"
                    >
                      {profileName}
                    </Link>
                  </p>
                  <p className="text-xs text-subtle">
                    Requested by {requesterName} ({requesterEmail})
                  </p>
                  <p className="mt-1 text-xs text-subtle">
                    Payout contact: {redemption.payoutContact}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-ink">{redemption.credits} Credits</p>
                  <p className="text-subtle">
                    Gross {formatCents(redemption.grossAmountCents)} · Fee{" "}
                    {formatCents(redemption.feeCents)}
                  </p>
                  <p className="font-semibold text-ink">
                    Net {formatCents(redemption.netAmountCents)}
                  </p>
                </div>
              </div>

              <div className="mt-3 border-t border-border pt-3">
                <AdminRedemptionReviewForm
                  redemptionId={redemption.id}
                  isSelf={redemption.requestedBy === admin.id}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
