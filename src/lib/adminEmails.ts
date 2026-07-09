// Pure, dependency-free admin check: reads only the ADMIN_EMAILS env var.
// Deliberately has NO other imports (no DB, no session) so it is safe to
// use from Edge Middleware, which cannot load node:sqlite. This is what
// makes it possible to block /admin/* at the routing layer, before any
// page component (and its DB access) even runs.
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
