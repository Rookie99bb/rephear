import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { getCurrentFullUser } from "@/lib/session";
import { getOrCreateInvitationForUser } from "@/db/invitations";
import { getSiteUrl } from "@/lib/siteUrl";
import { formatCents } from "@/lib/redemption";
import {
  getOrCreateReferrerProfile,
  getFunnelStats,
  getBalances,
  getCurrentRule,
  countOpenRiskFlags,
  CURRENT_TERMS_VERSION,
} from "@/db/referrerCommissions";
import ReferrerShareTools from "@/components/ReferrerShareTools";
import AcceptTermsForm from "@/components/AcceptTermsForm";
import RequestPayoutForm from "@/components/RequestPayoutForm";

export default async function ReferralsPage() {
  const user = await getCurrentFullUser();
  if (!user) redirect("/login");

  const [invitation, profile, funnel, balances, rule, openHighFlags] =
    await Promise.all([
      getOrCreateInvitationForUser(user.id),
      getOrCreateReferrerProfile(user.id),
      getFunnelStats(user.id),
      getBalances(user.id),
      getCurrentRule(),
      countOpenRiskFlags(user.id, "high"),
    ]);

  const inviteUrl = `${getSiteUrl()}/invite/${invitation.inviteCode}`;
  const qrDataUrl = await QRCode.toDataURL(inviteUrl, {
    width: 240,
    margin: 1,
    color: { dark: "#111113", light: "#ffffff" },
  }).catch(() => "");

  const termsAccepted = profile.termsVersion >= CURRENT_TERMS_VERSION;
  const isReferrer = balances.lifetimeEarnedCents > 0;

  let ineligibleReason: string | null = null;
  if (profile.status !== "active") {
    ineligibleReason =
      "Your referrer account is paused. Contact support to appeal.";
  } else if (!termsAccepted) {
    ineligibleReason = "Accept the Referrer Terms below to unlock withdrawals.";
  } else if (openHighFlags > 0) {
    ineligibleReason =
      "Withdrawals are on hold while your account is under review.";
  } else if (balances.availableCents < rule.minPayoutCents) {
    ineligibleReason = `Keep sharing — withdrawals unlock at ${formatCents(rule.minPayoutCents)} available.`;
  }
  const payoutEligible = ineligibleReason === null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-ink">
          Referral Hub
        </h1>
        {isReferrer && (
          <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-medium text-white">
            Referrer
          </span>
        )}
        {profile.status !== "active" && (
          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
            Paused
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-subtle">
        Share RepHear, grow the community, and earn {rule.rateBps / 100}% of
        every qualified Support your invitees make within {rule.windowDays}{" "}
        days of signing up. Commission depends on real, completed,
        non-refunded Support — never on signups alone.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <ReferrerShareTools inviteUrl={inviteUrl} qrDataUrl={qrDataUrl} />

        {/* Funnel */}
        <div className="rounded-xl border border-border p-4">
          <p className="text-sm font-semibold text-ink">Your funnel</p>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xl font-semibold text-ink">
                {funnel.clicksAllTime}
              </p>
              <p className="text-xs text-subtle">Link visits (all time)</p>
            </div>
            <div>
              <p className="text-xl font-semibold text-ink">
                {funnel.registrations30d}
              </p>
              <p className="text-xs text-subtle">
                Joined · 30d ({funnel.registrations7d} in 7d)
              </p>
            </div>
            <div>
              <p className="text-xl font-semibold text-ink">
                {funnel.payingReferrals30d}
              </p>
              <p className="text-xs text-subtle">
                Supporters · 30d ({funnel.payingReferrals7d} in 7d)
              </p>
            </div>
            <div>
              <p className="text-xl font-semibold text-ink">
                {formatCents(balances.lifetimeEarnedCents)}
              </p>
              <p className="text-xs text-subtle">Earned all time</p>
            </div>
          </div>
        </div>

        {/* Balances */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs text-subtle">Confirming</p>
            <p className="mt-1 text-lg font-semibold text-ink">
              {formatCents(balances.pendingCents)}
            </p>
            <p className="mt-0.5 text-xs text-subtle">
              In the 14-day hold
            </p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs text-subtle">Available</p>
            <p className="mt-1 text-lg font-semibold text-ink">
              {formatCents(balances.availableCents)}
            </p>
            <p className="mt-0.5 text-xs text-subtle">Ready to withdraw</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs text-subtle">Paid out</p>
            <p className="mt-1 text-lg font-semibold text-ink">
              {formatCents(balances.lifetimePaidCents)}
            </p>
            <p className="mt-0.5 text-xs text-subtle">Sent to you</p>
          </div>
        </div>

        <div className="flex gap-3 text-sm">
          <Link
            href="/referrals/commissions"
            className="font-medium text-ink underline"
          >
            Commission details
          </Link>
          <Link
            href="/referrals/payouts"
            className="font-medium text-ink underline"
          >
            Withdrawal history
          </Link>
        </div>

        {!termsAccepted ? (
          <AcceptTermsForm />
        ) : (
          <RequestPayoutForm
            availableCents={balances.availableCents}
            minPayoutCents={rule.minPayoutCents}
            eligible={payoutEligible}
            ineligibleReason={ineligibleReason}
          />
        )}

        <div className="rounded-xl bg-muted p-4 text-xs leading-relaxed text-subtle">
          <p className="font-semibold text-ink">How it works</p>
          <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5">
            <li>
              {rule.rateBps / 100}% of each qualified Support, within{" "}
              {rule.windowDays} days of your invitee&apos;s signup.
            </li>
            <li>
              Commission is held {rule.freezeDays} days after payment, then
              becomes withdrawable. Refunded or disputed payments earn
              nothing.
            </li>
            <li>
              Payouts are reviewed and sent manually once a month. You are
              responsible for any tax on commission you receive.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
