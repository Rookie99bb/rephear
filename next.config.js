/** @type {import('next').NextConfig} */

// Security headers applied to every response. Kept conservative and
// verified locally (build + start + manual checks) specifically so they
// don't break Next.js's own inline hydration scripts, Tailwind's inline
// `style={{...}}` attributes (e.g. src/components/Avatar.tsx), or the
// Stripe Checkout flow (which is a full-page redirect via
// `window.location`/server `session.url` — this app never loads
// Stripe.js client-side and never frames Stripe, so no Stripe-specific
// CSP allowances are needed).
const securityHeaders = [
  // Prevents this site from ever being framed by another origin
  // (clickjacking). X-Frame-Options is the older/wider-supported
  // mechanism; frame-ancestors below is the modern CSP equivalent —
  // kept both for defense-in-depth across browsers.
  { key: "X-Frame-Options", value: "DENY" },
  // Stops browsers from MIME-sniffing a response away from its
  // declared Content-Type (e.g. treating an uploaded file as HTML/JS).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Sends the full referrer only to our own origin; cross-origin
  // requests only get the origin, never the full path/query (which
  // could otherwise leak ranking/profile IDs to third parties via the
  // Referer header on outbound links).
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disables a set of browser features this app never uses. Left
  // deliberately short/conservative rather than blocking everything,
  // to avoid breaking a feature we didn't think to test for.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // HSTS: tells browsers that already visited https://rephear.com to
  // never attempt plain HTTP again for the next 180 days. Render
  // terminates TLS and already serves this app over HTTPS, so this is
  // safe to send. Deliberately NOT including `preload` — submitting to
  // the browser HSTS preload list is a separate, harder-to-reverse
  // decision that should be made deliberately, not auto-applied here.
  {
    key: "Strict-Transport-Security",
    value: "max-age=15552000; includeSubDomains",
  },
  // Content-Security-Policy: allow same-origin scripts/styles plus
  // 'unsafe-inline' for both — required because (a) Next.js's App
  // Router injects inline hydration/data scripts on every page, and
  // (b) a few components (e.g. Avatar.tsx) use inline `style={{}}`
  // attributes. This is a known, documented trade-off: a stricter
  // nonce-based CSP is possible but requires wiring a per-request nonce
  // through middleware and every layout, which is a larger change with
  // real risk of breaking rendering — flagged in the audit report as a
  // future hardening step rather than applied blindly here.
  // img-src allows https: because Nominee/profile photoUrl is a
  // user-supplied external image URL by design (see Avatar.tsx) — not
  // a bug, an intended product feature that would break under a
  // same-origin-only img-src.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' https: data:",
      "font-src 'self'",
      "connect-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
