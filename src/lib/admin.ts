import { getCurrentFullUser } from "@/lib/session";
import { isAdminEmail } from "@/lib/adminEmails";

export { isAdminEmail };

// Returns the current user (full DB row, including isAdmin) only if they
// are an admin, otherwise null. Used in Server Components/Actions (Node
// runtime, has DB access) — see src/middleware.ts for the Edge-runtime
// equivalent check that runs before this ever gets a chance to.
//
// Admin status is DB-driven (users.is_admin — see src/app/admin/users),
// not just the ADMIN_EMAILS env var. This function always does a fresh
// DB read, so revoking someone's admin access here takes effect
// immediately, on their very next request — unlike the Edge middleware
// check, which reads a snapshot baked into the session JWT at login time
// and only refreshes on next sign-in. That asymmetry is intentional: the
// slower-to-update layer (middleware) fails toward blocking a stale
// non-admin from getting further; the always-fresh layer (this function)
// is the actual authority every admin page and action relies on.
export async function getCurrentAdmin() {
  const user = await getCurrentFullUser();
  if (!user || !user.isAdmin) return null;
  return user;
}
