import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin";
import { listPayoutRequests } from "@/db/referrerCommissions";
import type { ReferralPayoutStatus } from "@/lib/types";

// CSV export of payout requests for the monthly manual settlement batch
// (PRD: 每月人工批量结算). Admin-only. ?status=approved (default) pulls
// the settlement batch; ?status=requested pulls the review queue.
export async function GET(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const raw = request.nextUrl.searchParams.get("status") ?? "approved";
  const status = (["requested", "approved", "paid", "rejected", "all"].includes(raw)
    ? raw
    : "approved") as ReferralPayoutStatus | "all";

  const rows = await listPayoutRequests(status);

  const header = [
    "payout_id",
    "user_name",
    "user_email",
    "amount_cents",
    "amount_usd",
    "currency",
    "payout_contact",
    "status",
    "requested_at",
    "reviewed_at",
    "provider_ref",
    "admin_notes",
  ];
  const esc = (v: string | number | null | undefined): string => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(",")];
  for (const { payout, userName, userEmail } of rows) {
    lines.push(
      [
        esc(payout.id),
        esc(userName),
        esc(userEmail),
        esc(payout.amountCents),
        esc((payout.amountCents / 100).toFixed(2)),
        esc(payout.currency),
        esc(payout.payoutContact),
        esc(payout.status),
        esc(payout.requestedAt),
        esc(payout.reviewedAt),
        esc(payout.providerRef),
        esc(payout.adminNotes),
      ].join(",")
    );
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="referral-payouts-${status}.csv"`,
    },
  });
}
