import Stripe from "stripe";

// The Stripe client is created lazily (not at module load) so the app can
// still build/boot without STRIPE_SECRET_KEY set. Live Mode later only
// requires swapping the env var values — no code changes.
let client: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (client) return client;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to .env.local (use a Stripe test-mode secret key while developing)."
    );
  }

  client = new Stripe(key, { apiVersion: "2026-06-24.dahlia" });
  return client;
}

export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is not set. Add it to .env.local (from `stripe listen` or your Stripe dashboard webhook config)."
    );
  }
  return secret;
}
