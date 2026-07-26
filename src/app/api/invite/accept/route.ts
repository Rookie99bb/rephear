import { NextRequest, NextResponse } from "next/server";
import { findInvitationByCode } from "@/db/invitations";
import { getCurrentUser } from "@/lib/session";

// Sets the referral-tracking cookie and sends the visitor on to sign up.
// This is a Route Handler (not the /invite/[code] page itself) because
// only a real request/response — not a Server Component render — can
// set a cookie in this Next.js version. The cookie carries the invite
// *code*, not the owner's raw user id; signupAction re-resolves the code
// to a referrer server-side and re-validates everything, so nothing
// here is trusted at face value later.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const base = request.nextUrl.origin;

  if (!code) {
    return NextResponse.redirect(new URL("/signup", base));
  }

  const invitation = await findInvitationByCode(code);
  const response = NextResponse.redirect(new URL("/signup", base));
  if (!invitation) {
    return response;
  }

  // Already signed in — nothing to track, just send them home instead
  // of through the signup flow.
  const viewer = await getCurrentUser();
  if (viewer) {
    return NextResponse.redirect(new URL("/", base));
  }

  response.cookies.set("rephear_ref", invitation.inviteCode, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
  return response;
}
