import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Defense-in-depth: this runs on the Edge, before any /admin page (or its
// DB access) executes, and blocks non-admins outright. It's deliberately
// independent of the redirect already done in src/app/admin/layout.tsx —
// either one alone would stop a normal user, but having both means a bug
// in one layer doesn't expose the Admin Panel.
//
// Admin status is DB-driven (users.is_admin, see src/app/admin/users),
// but the Edge runtime here can't cheaply hit the database on every
// request the way lib/admin.ts's getCurrentAdmin() does — so this reads
// the `isAdmin` claim baked into the signed session JWT at login instead
// (see the jwt() callback in lib/auth.ts). That claim is only a
// snapshot: both granting and revoking admin access via /admin/users
// only take effect *here* on that user's next sign-in, not immediately.
// That's fine because this layer is pure defense-in-depth, not the
// actual authority — every admin page and Server Action independently
// re-checks getCurrentAdmin() (lib/admin.ts), which reads users.is_admin
// fresh from the database on every single request, so a revoked admin
// is always fully locked out immediately regardless of what their stale
// JWT still claims. This layer just means a non-admin whose token
// happens to be stale-non-admin never even reaches that DB check.
export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token?.isAdmin) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
