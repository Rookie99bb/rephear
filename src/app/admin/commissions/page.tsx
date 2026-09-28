import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin";
import { formatCents } from "@/lib/redemption";
import {
  listAllCommissions,
  listPayoutRequests,
  listReferrersWithOpenFlags,
  getReferrerAdminDetail,
  listRiskFlags,
  getBalances,
} from "@/db/referrerCommissions";
import AdminPayoutReviewForm from "@/components/AdminPayoutReviewForm";
import {
  AdminReferrerStatusToggle,
  AdminAddRiskFlagForm,
  AdminResolveFlagButton,
} from "@/components/AdminReferrerControls";
import type { ReferralCommissionStatus } from "@/lib/types";

const TABS = [
  { id: "ledger", label: "Ledger" },
  { id: "payouts", label: "Payouts" },
  { id: "risk", label: "Risk" },
] as const;

const LEDGER_TABS: { label: string; status: ReferralCommissionStatus | "all" }[] = [
  { label: "All", status: "all" },
  { label: "Confirming", status: "pending" },
  { label: "Available", status: "available" },
  { label: "Paid", status: "paid" },
  { label: "Reversed", status: "reversed" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso.replace(" ", "T") + "Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const tabHref = (tab: string, extra: Record<string, string> = {}) => {
  const params = new URLSearchParams({ tab, ...extra });
  return `/admin/commissions?${params.toString()}`;
};

export default async function AdminCommissionsPage({
  searchParams,
}: {
  searchParams: {
    tab?: string;
    status?: string;
    q?: string;
    userId?: string;
  };
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/");

  const tab = TABS.some((t) => t.id === searchParams.tab)
    ? (searchParams.tab as (typeof TABS)[number]["id"])
    : "ledger";

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-xl font-semibold tracking-tight text-ink">
        Referral Commissions
      </h1>
      <p className="mt-1 text-sm text-subtle">
        Per-commission ledger, payout review, and fraud review for the
        referrer program.
      </p>

      <div className="mt-4 flex gap-2 border-b border-border">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={tabHref(t.id)}
            className={`px-3 py-2 text-sm font-medium ${
              tab === t.id
                ? "border-b-2 border-ink text-ink"
                : "text-subtle hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "ledger" && <LedgerTab status={searchParams.status} q={searchParams.q} />}
      {tab === "payouts" && <PayoutsTab adminId={admin.id} />}
      {tab === "risk" && <RiskTab userId={searchParams.userId} />}
    </div>
  );
}

async function LedgerTab({ status, q }: { status?: string; q?: string }) {
  const activeStatus =
    LEDGER_TABS.find((t) => t.status === status)?.status ?? "all";
  const { rows: items } = await listAllCommissions({
    status: activeStatus,
    search: q,
    limit: 100,
  });

  return (
    <div className="mt-4">
      <form
        method="get"
        action="/admin/commissions"
        className="flex flex-wrap gap-2"
      >
        <input type="hidden" name="tab" value="ledger" />
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search referrer name, email, payment id…"
          className="w-72 rounded-lg border border-border px-2.5 py-2 text-xs outline-none focus:border-ink"
        />
        <button
          type="submit"
          className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-ink hover:bg-muted"
        >
          Search
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {LEDGER_TABS.map((t) => (
          <Link
            key={t.status}
            href={tabHref("ledger", {
              ...(t.status !== "all" ? { status: t.status } : {}),
              ...(q ? { q } : {}),
            })}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              activeStatus === t.status
                ? "bg-ink text-white"
                : "border border-border text-subtle hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-subtle">No commissions match.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-subtle">
                <th className="px-3 py-2 font-medium">Earned</th>
                <th className="px-3 py-2 font-medium">Referrer</th>
                <th className="px-3 py-2 font-medium">Support</th>
                <th className="px-3 py-2 font-medium">Commission</th>
                <th className="px-3 py-2 font-medium">Available</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ commission, referrerName, referrerEmail }) => (
                <tr key={commission.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2">{formatDate(commission.createdAt)}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-ink">{referrerName}</p>
                    <p className="text-subtle">{referrerEmail}</p>
                  </td>
                  <td className="px-3 py-2">{formatCents(commission.grossCents)}</td>
                  <td className="px-3 py-2 font-medium text-ink">
                    {formatCents(commission.commissionCents)}
                  </td>
                  <td className="px-3 py-2">{formatDate(commission.availableAt)}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-subtle">
                      {commission.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

async function PayoutsTab({ adminId }: { adminId: string }) {
  const [requested, approved, paidAll] = await Promise.all([
    listPayoutRequests("requested"),
    listPayoutRequests("approved"),
    listPayoutRequests("paid"),
  ]);
  const history = paidAll.slice(-30);

  const renderQueue = (
    rows: Awaited<ReturnType<typeof listPayoutRequests>>,
    emptyText: string
  ) => (
    <ul className="flex flex-col gap-3">
      {rows.length === 0 ? (
        <p className="text-sm text-subtle">{emptyText}</p>
      ) : (
        rows.map(({ payout, userName, userEmail }) => (
          <li key={payout.id} className="rounded-xl border border-border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">
                  {formatCents(payout.amountCents)} {payout.currency}
                  <span className="ml-2 font-normal text-subtle">
                    {userName} · {userEmail}
                  </span>
                </p>
                <p className="mt-1 text-xs text-subtle">
                  Requested {formatDate(payout.requestedAt)}
                  {payout.payoutContact && ` · to: ${payout.payoutContact}`}
                </p>
                {payout.adminNotes && (
                  <p className="mt-0.5 text-xs text-subtle">
                    Note: {payout.adminNotes}
                  </p>
                )}
                {payout.providerRef && (
                  <p className="mt-0.5 text-xs text-subtle">
                    Ref: {payout.providerRef}
                  </p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-subtle">
                {payout.status}
              </span>
            </div>
            <div className="mt-3">
              <AdminPayoutReviewForm
                payoutId={payout.id}
                status={payout.status}
                isSelf={payout.userId === adminId}
              />
            </div>
          </li>
        ))
      )}
    </ul>
  );

  return (
    <div className="mt-4 flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Review queue</h2>
        <div className="flex gap-2 text-xs">
          <a
            href="/api/admin/commissions/export?status=requested"
            className="font-medium text-ink underline"
          >
            CSV: queue
          </a>
          <a
            href="/api/admin/commissions/export?status=approved"
            className="font-medium text-ink underline"
          >
            CSV: settlement batch
          </a>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">
          Requested ({requested.length})
        </h3>
        {renderQueue(requested, "Nothing waiting for review.")}
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">
          Approved — ready to pay ({approved.length})
        </h3>
        {renderQueue(
          approved,
          "No approved payouts. Approved requests appear here until marked paid."
        )}
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">
          Recently paid
        </h3>
        <ul className="flex flex-col gap-2 text-xs">
          {history.map(({ payout, userName, userEmail }) => (
            <li
              key={payout.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border px-3 py-2"
            >
              <span className="font-semibold text-ink">
                {formatCents(payout.amountCents)}
              </span>
              <span className="text-subtle">
                {userName} · {userEmail}
              </span>
              <span className="text-subtle">
                reviewed {formatDate(payout.reviewedAt)}
                {payout.providerRef && ` · ${payout.providerRef}`}
              </span>
            </li>
          ))}
          {history.length === 0 && (
            <p className="text-sm text-subtle">No payouts sent yet.</p>
          )}
        </ul>
      </div>

      <p className="text-xs leading-relaxed text-subtle">
        Payouts are paid externally and manually — this panel records the
        decision, never moves money itself. Export the settlement batch CSV
        each month and pay via your normal provider.
      </p>
    </div>
  );
}

async function RiskTab({ userId }: { userId?: string }) {
  const flagged = await listReferrersWithOpenFlags();

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-2">
      <div>
        <h2 className="text-sm font-semibold text-ink">Flagged referrers</h2>
        {flagged.length === 0 ? (
          <p className="mt-2 text-sm text-subtle">
            No open risk flags. Clean.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {flagged.map((f) => (
              <li key={f.userId}>
                <Link
                  href={tabHref("risk", { userId: f.userId })}
                  className={`block rounded-xl border p-3 transition ${
                    userId === f.userId
                      ? "border-ink"
                      : "border-border hover:border-ink/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {f.userName}
                      </p>
                      <p className="text-xs text-subtle">{f.userEmail}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-subtle">
                        {f.openFlags} open
                      </span>
                      {f.highFlags > 0 && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          {f.highFlags} high
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>{userId ? <ReferrerDetail userId={userId} /> : <p className="text-sm text-subtle">Select a referrer to review their profile, flags, and ledger.</p>}</div>
    </div>
  );
}

async function ReferrerDetail({ userId }: { userId: string }) {
  const detail = await getReferrerAdminDetail(userId);
  if (!detail) {
    return <p className="text-sm text-subtle">Referrer not found.</p>;
  }
  const [flags, balances] = await Promise.all([
    listRiskFlags(userId, "open"),
    getBalances(userId),
  ]);

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">
            {detail.userName}
          </p>
          <p className="text-xs text-subtle">{detail.userEmail}</p>
          <p className="mt-1 text-xs text-subtle">
            Terms v{detail.profile.termsVersion} ·{" "}
            {detail.profile.termsAcceptedAt
              ? `accepted ${formatDate(detail.profile.termsAcceptedAt)}`
              : "not accepted"}
          </p>
        </div>
        <AdminReferrerStatusToggle
          userId={userId}
          status={detail.profile.status}
        />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg bg-muted/50 p-2">
          <p className="text-subtle">Confirming</p>
          <p className="font-semibold text-ink">
            {formatCents(balances.pendingCents)}
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 p-2">
          <p className="text-subtle">Available</p>
          <p className="font-semibold text-ink">
            {formatCents(balances.availableCents)}
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 p-2">
          <p className="text-subtle">Paid</p>
          <p className="font-semibold text-ink">
            {formatCents(balances.lifetimePaidCents)}
          </p>
        </div>
      </div>

      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-subtle">
        Open flags
      </h3>
      {flags.length === 0 ? (
        <p className="mt-1 text-xs text-subtle">None.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {flags.map((f) => (
            <li
              key={f.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border p-2.5"
            >
              <div>
                <p className="text-xs font-medium text-ink">
                  {f.type}
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-subtle">
                    {f.severity}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-subtle">
                  {formatDate(f.createdAt)}
                  {f.evidenceRef && ` · ${f.evidenceRef}`}
                </p>
              </div>
              <AdminResolveFlagButton flagId={f.id} />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <AdminAddRiskFlagForm userId={userId} />
      </div>
    </div>
  );
}
