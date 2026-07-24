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

// Claim-workflow security upgrade: a single, optional, dependency-free
// "founder" designation, deliberately separate from ADMIN_EMAILS/is_admin
// (a founder must always also be a real admin — this only narrows who,
// among admins, may ever invoke the Founder Claim Override in
// src/lib/actions/claimRequests.ts). Reading FOUNDER_EMAIL is identical
// in shape to isAdminEmail() above so this stays Edge-Middleware-safe,
// even though the override action itself only ever runs server-side
// (Node runtime, not Edge). Unset FOUNDER_EMAIL entirely to disable the
// override mechanism outright — see founderOverrideClaimAction's own
// countAdmins() === 1 guard for the other half of "easy to disable and
// impossible to lean on once the team grows past one admin."
export function isFounderEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = (process.env.FOUNDER_EMAIL || "").trim().toLowerCase();
  if (!raw) return false;
  return raw === email.toLowerCase();
}
