// Canonical public origin for this app (e.g. "https://rephear.com").
//
// Do NOT derive this from the incoming request (request.nextUrl.origin /
// request.headers.get("host")) when running behind Render's reverse
// proxy: the Host the Next.js server actually sees is the proxy's
// internal address, not the public domain — in practice that showed up
// as "http://localhost:10000" (Render's internal container port) being
// used as the Stripe Checkout success_url, which meant paying customers
// landed on an unreachable localhost URL after a real charge.
//
// NEXTAUTH_URL is already required to be set to the true public URL (NextAuth's
// own callback/redirect URLs depend on it), so it's the one trustworthy
// source of truth — same pattern already used by the transactional
// emails in src/emails/*.
export function getSiteUrl(): string {
  return process.env.NEXTAUTH_URL || "https://public-reputation.onrender.com";
}
