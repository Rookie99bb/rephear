import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { findProfileById, getProfileStats } from "@/db/profiles";
import { listRedemptionsForProfile, reservedCreditsForProfile } from "@/db/redemptions";
import { getCurrentUser } from "@/lib/session";
import RedemptionRequestForm from "@/components/RedemptionRequestForm";
import { formatCents } from "@/lib/redemption";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending review",
  paid: "Paid",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "text-amber-700",
  paid: "text-emerald-700",
  rejected: "text-red-600",
  cancelled: "text-subtle",
};

export default async function RedeemPage({ params }: { params: { id: string } }) {
  const profile = await findProfileById(params.id);
  if (!profile) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (profile.claimStatus !== "claimed" || profile.claimedBy !== user.id) {
    notFound();
  }

  const stats = await getProfileStats(profile.id);
  const reserved = await reservedCreditsForProfile(profile.id);
  const available = stats.totalReputationCredits - reserved;
  const history = await listRedemptionsForProfile(profile.id);

  return (
    <div className="mx-auto max-w-xl">
      <Link
        href={`/profiles/${profile.id}`}
        className="text-xs font-medium text-subtle hover:text-ink"
      >
        ← Back to {profile.name}
      </Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight text-ink">
        Redeem Support
      </h1>
      <p className="mt-1 text-sm text-subtle">
        Cash out the Reputation Credits {profile.name} has received as paid
        Support. RepHear keeps a 20% service fee on every redemption; you
        receive the remaining 80%.
      </p>

      <div className="mt-6 flex gap-8 border-y border-border py-4">
        <Stat label="Total Credits earned" value={stats.totalReputationCredits} />
        <Stat label="Available to redeem" value={available} />
      </div>

      <div className="mt-6 rounded-xl border border-border p-5">
        <RedemptionRequestForm profileId={profile.id} available={available} />
      </div>

      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-subtle">
            Redemption History
          </h2>
          <ul className="flex flex-col gap-2">
            {history.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-1 rounded-xl border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-ink">
                    {r.credits} Credits → {formatCents(r.netAmountCents)} net
                  </p>
                  <p className="text-xs text-subtle">
                    Requested {new Date(r.requestedAt).toLocaleDateString()}
                    {" · "}
                    Gross {formatCents(r.grossAmountCents)}, fee{" "}
                    {formatCents(r.feeCents)}
                  </p>
                </div>
                <span className={`text-xs font-semibold ${STATUS_CLASS[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-lg font-semibold tracking-tight text-ink">{value}</p>
      <p className="text-xs text-subtle">{label}</p>
    </div>
  );
}
