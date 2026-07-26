// Pure, dependency-free helper for the DMCA/takedown contact address —
// same shape as isAdminEmail()/isFounderEmail() in adminEmails.ts, so it
// stays safe to import anywhere (including Edge Middleware, though it
// isn't currently needed there). Configurable via env so the address can
// be changed without a code change/redeploy of anything else; falls back
// to a sane default so the footer link and /legal/dmca page always work
// even before the real inbox is provisioned.
export function getDmcaEmail(): string {
  return (process.env.DMCA_EMAIL || "dmca@rephear.com").trim();
}
