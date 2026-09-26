import { NextRequest, NextResponse } from "next/server";
import { notFound } from "next/navigation";
import {
  findCampaignLinkBySlug,
  recordCampaignVisit,
  CAMPAIGN_COOKIE,
} from "@/db/campaignLinks";
import { getCurrentUser } from "@/lib/session";

// Campaign ("support") short link: rephear.com/s/<slug> (e.g. /s/luna2026).
// Logs the visit, drops an attribution cookie for later signup credit,
// then redirects to the nominee's /n/TOKEN vote page (which already has
// the Like / Credits-support CTAs and a link through to the full ranking).
// A Route Handler (not a page) because only a real request/response can
// set a cookie in this Next.js version.
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const link = await findCampaignLinkBySlug(params.slug);
  if (!link) notFound();

  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || null;
  // Analytics only — a failed insert must never break the redirect.
  await recordCampaignVisit(link.id, ip).catch((err) =>
    console.error("[campaign] visit log failed", err)
  );

  const response = NextResponse.redirect(
    new URL(`/n/${link.shareToken}`, request.nextUrl.origin),
    302
  );

  // Already signed in — nothing to attribute, just send them through.
  const viewer = await getCurrentUser();
  if (!viewer) {
    response.cookies.set(CAMPAIGN_COOKIE, link.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });
  }
  return response;
}
