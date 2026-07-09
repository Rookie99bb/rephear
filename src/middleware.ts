import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isAdminEmail } from "@/lib/adminEmails";

// Defense-in-depth: this runs on the Edge, before any /admin page (or its
// DB access) executes, and blocks non-admins outright. It's deliberately
// independent of the redirect already done in src/app/admin/layout.tsx —
// either one alone would stop a normal user, but having both means a bug
// in one layer doesn't expose the Admin Panel.
export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const email = typeof token?.email === "string" ? token.email : null;
  if (!isAdminEmail(email)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
