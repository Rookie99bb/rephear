// Reputation Credit → real-money redemption. A claimed profile's owner
// can cash out the Credits their profile has received as paid Support.
// The platform keeps a 20% service fee on every redemption; the owner
// receives the remaining 80% as fiat. This mirrors the purchase-side
// exchange rate (see src/lib/creditPackages.ts: 1 USD = 10 Credits, i.e.
// 1 Credit = 10 cents), so the same number of Credits is worth the same
// gross dollar amount whether you're buying or redeeming — only the fee
// is new, and it only applies on the way out.

export const REDEMPTION_FEE_RATE = 0.2; // platform keeps 20%
export const CENTS_PER_CREDIT = 10; // 1 Credit = $0.10, matches creditPackages.ts
export const MIN_REDEMPTION_CREDITS = 10; // $1 gross minimum — avoids sub-cent/near-zero payouts after the fee

export interface RedemptionAmounts {
  grossAmountCents: number;
  feeCents: number;
  netAmountCents: number;
}

// Always compute the fee from the gross amount, and derive net as
// gross - fee (never gross * (1 - rate) independently) so the three
// numbers always add up exactly with no floating-point drift between
// what's displayed and what's stored.
export function computeRedemptionAmounts(credits: number): RedemptionAmounts {
  const grossAmountCents = Math.round(credits * CENTS_PER_CREDIT);
  const feeCents = Math.round(grossAmountCents * REDEMPTION_FEE_RATE);
  const netAmountCents = grossAmountCents - feeCents;
  return { grossAmountCents, feeCents, netAmountCents };
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
