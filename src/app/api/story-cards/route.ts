// Phase 5.6: backer story cards — server-rendered 1080×1080 PNG.
//
// Server-side eligibility is enforced HERE, never UI-only:
//   401 — not signed in.
//   403 — not the backing user (not_backer), or a private card requested
//         without a valid signed URL (unsigned).
//   404 — unknown profile/milestone (incl. fabricated milestone ids),
//         no Early Backer award (no data proof), or no data to render.
// Public backers get a normal shareable URL; private backers only ever
// render over a verified signed URL, served with X-Robots-Tag noindex.

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import {
  getStoryCardData,
  STORY_CARD_TYPES,
  type StoryCardType,
  type StoryCardDenial,
} from "@/lib/storyCards";
import {
  verifyStoryCardToken,
  type StoryCardTokenPayload,
} from "@/lib/storyCardTokens";
import { renderShareCardPng } from "@/lib/shareCardRenderer";

export const dynamic = "force-dynamic";

const DENIAL_STATUS: Record<StoryCardDenial, number> = {
  not_found: 404,
  not_backer: 403,
  no_award: 404,
  no_milestone: 404,
  unavailable: 404,
  unsigned: 403,
};

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const type = params.get("type") ?? "";
  if (!(STORY_CARD_TYPES as readonly string[]).includes(type)) {
    return NextResponse.json({ error: "Invalid card type" }, { status: 400 });
  }
  const rankingId = params.get("rankingId") ?? undefined;
  const profileId = params.get("profileId") ?? undefined;
  const milestoneId = params.get("milestoneId") ?? undefined;
  const sig = params.get("sig") ?? undefined;

  // Signed path: the token must be valid, belong to this user, and match
  // the requested card scope exactly.
  let signed = false;
  let payload: StoryCardTokenPayload | null = null;
  if (sig) {
    payload = verifyStoryCardToken(sig);
    signed =
      !!payload &&
      payload.u === user.id &&
      payload.t === type &&
      (payload.r ?? undefined) === rankingId &&
      (payload.p ?? undefined) === profileId &&
      (payload.m ?? undefined) === milestoneId;
  }

  const result = await getStoryCardData({
    type: type as StoryCardType,
    rankingId,
    profileId,
    milestoneId,
    viewerUserId: user.id,
    signed,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: `Story card unavailable: ${result.reason}` },
      { status: DENIAL_STATUS[result.reason] }
    );
  }

  const png = await renderShareCardPng(result.data);
  const headers: Record<string, string> = {
    "Content-Type": "image/png",
    "Content-Disposition": `inline; filename="rephear-story-${type}.png"`,
  };
  if (result.visibility === "private") {
    // Author-only card: never indexed, never shared-cached.
    headers["X-Robots-Tag"] = "noindex, nofollow";
    headers["Cache-Control"] = "private, max-age=3600";
  } else {
    headers["Cache-Control"] = "public, max-age=3600";
  }
  return new NextResponse(new Uint8Array(png), { status: 200, headers });
}
