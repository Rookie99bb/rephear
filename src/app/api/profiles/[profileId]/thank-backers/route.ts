import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import {
  thankEarlyBackers,
  type ThankBackersDenial,
} from "@/db/nomineeThanks";

export const dynamic = "force-dynamic";

const DENIAL_STATUS: Record<ThankBackersDenial, number> = {
  not_found: 404,
  not_claimed: 403,
  not_owner: 403,
  already_thanked: 429,
};

// Phase 5.5: POST /api/profiles/[id]/thank-backers — the claiming
// owner's one-click "Thank my early backers". Claimed-gating is
// enforced server-side in thankEarlyBackers (unclaimed → 403,
// non-owner → 403); the thank is rate-limited to once per milestone
// scope (repeat → 429). The response carries only the aggregate count —
// never names, never a recipient list.
export async function POST(
  _request: NextRequest,
  { params }: { params: { profileId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const result = await thankEarlyBackers({
    profileId: params.profileId,
    actorUserId: user.id,
  });
  if (!result.ok) {
    return NextResponse.json(result, { status: DENIAL_STATUS[result.reason] });
  }
  return NextResponse.json(result);
}
