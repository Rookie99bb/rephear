import { getCurrentUser } from "@/lib/session";

// Admins are identified by an allow-list of emails (ADMIN_EMAILS env var,
// comma-separated) rather than a hardcoded account or a self-service role
// field a user could set on themselves. Whoever controls the deployment's
// environment variables controls who is an admin.
function adminEmailSet(): Set<string> {
  const raw = process.env.ADMIN_EMAILS || "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmailSet().has(email.toLowerCase());
}

// Returns the current user only if they are an admin, otherwise null.
export async function getCurrentAdmin() {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}
