import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import {
  getShareCardData,
  SHARE_CARD_TYPES,
  type ShareCardType,
  type ShareCardDenial,
} from "@/lib/shareCards";
import { renderShareCardPng } from "@/lib/shareCardRenderer";

export const dynamic = "force-dynamic";

const DENIAL_STATUS: Record<ShareCardDenial, number> = {
  not_found: 404,
  not_claimed: 403,
  not_owner: 403,
  no_milestones: 404,
  unavailable: 404,
};

// Phase 4: server-rendered milestone share cards (1080×1080 PNG).
// Claimed-gating is enforced HERE, server-side — the share page UI is
// convenience only. Only the claiming owner (claimed_by) can generate
// a card for their nominee.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const rankingId = params.get("rankingId") ?? "";
  const profileId = params.get("profileId") ?? "";
  const type = params.get("type") ?? "";
  if (
    !rankingId ||
    !profileId ||
    !(SHARE_CARD_TYPES as readonly string[]).includes(type)
  ) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const result = await getShareCardData({
    rankingId,
    profileId,
    type: type as ShareCardType,
    viewerUserId: user.id,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: `Share card unavailable: ${result.reason}` },
      { status: DENIAL_STATUS[result.reason] }
    );
  }

  const png = await renderShareCardPng(result.data);
  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      // Data is frozen at generation (labeled on the card); safe to
      // cache briefly. Re-requests re-render with fresh numbers.
      "Cache-Control": "public, max-age=3600",
      "Content-Disposition": `inline; filename="rephear-${type}-${profileId}.png"`,
    },
  });
}
