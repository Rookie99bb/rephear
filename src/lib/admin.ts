import { getCurrentUser } from "@/lib/session";
import { isAdminEmail } from "@/lib/adminEmails";

export { isAdminEmail };

// Returns the current user only if they are an admin, otherwise null.
// Used in Server Components/Actions (Node runtime, has DB access) —
// see src/middleware.ts for the Edge-runtime equivalent check that runs
// before this ever gets a chance to.
export async function getCurrentAdmin() {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}
