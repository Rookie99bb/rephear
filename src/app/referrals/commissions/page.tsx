import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentFullUser } from "@/lib/session";
import { formatCents } from "@/lib/redemption";
import {
  listCommissionsForReferrer,
} from "@/db/referrerCommissions";
import type { ReferralCommissionStatus } from "@/lib/types";

const TABS: { label: string; status: ReferralCommissionStatus | "all" }[] = [
  { label: "All", status: "all" },
  { label: "Confirming", status: "pending" },
  { label: "Available", status: "available" },
  { label: "Paid", status: "paid" },
  { label: "Reversed", status: "reversed" },
];

const STATUS_STYLES: Record<ReferralCommissionStatus, string> = {
  pending: "bg-amber-100 text-amber-900",
  available: "bg-emerald-100 text-emerald-800",
  paid: "bg-sky-100 text-sky-800",
  reversed: "bg-red-100 text-red-700",
};

function formatDate(iso: string): string {
  return new Date(iso.replace(" ", "T") + "Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function CommissionsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const user = await getCurrentFullUser();
  if (!user) redirect("/login");

  const activeTab =
    TABS.find((t) => t.status === searchParams.status) ?? TABS[0];
  const items = await listCommissionsForReferrer(
    user.id,
    activeTab.status === "all" ? {} : { status: activeTab.status }
  );

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/referrals"
        className="text-xs font-medium text-subtle hover:text-ink"
      >
        ← Referral Hub
      </Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight text-ink">
        Commission details
      </h1>
      <p className="mt-1 text-sm text-subtle">
        Every commission, traceable to the payment that earned it. Invitees
        are shown anonymously.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.status}
            href={`/referrals/commissions${t.status === "all" ? "" : `?status=${t.status}`}`}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              activeTab.status === t.status
                ? "bg-ink text-white"
                : "border border-border text-subtle hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-subtle">
          Nothing here yet — share your invite link to start earning.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {items.map(({ commission, refereeDisplay, refereeJoinedAt, adjustmentsCents }) => (
            <li
              key={commission.id}
              className="rounded-xl border border-border p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink">
                    {formatCents(commission.commissionCents)}
                    <span className="ml-2 text-xs font-normal text-subtle">
                      {commission.rateBps / 100}% of{" "}
                      {formatCents(commission.grossCents)} Support
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-subtle">
                    From {refereeDisplay} · joined {formatDate(refereeJoinedAt)} ·
                    earned {formatDate(commission.createdAt)}
                  </p>
                  {commission.status === "pending" && (
                    <p className="mt-0.5 text-xs text-subtle">
                      Available {formatDate(commission.availableAt)} (14-day hold)
                    </p>
                  )}
                  {adjustmentsCents !== 0 && (
                    <p className="mt-0.5 text-xs text-red-600">
                      Adjustment {formatCents(adjustmentsCents)}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[commission.status]}`}
                >
                  {commission.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
