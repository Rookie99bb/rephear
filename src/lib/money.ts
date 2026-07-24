// Shared currency-aware money formatter for admin-only business metrics
// (Admin > Users, Admin > Users > [id]). This never converts or invents
// a currency — it only formats whatever currency is actually stored on
// a payment record (payments.currency, see src/db/schema.ts). RepHear's
// checkout currently only ever creates "usd" payments (see
// src/app/api/checkout/route.ts), so in practice this always renders
// "$", but it stays correct if that ever changes.
export function formatMoney(amountCents: number, currency: string): string {
  const code = (currency || "usd").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amountCents / 100);
  } catch {
    // Unrecognized currency code — fall back rather than throwing.
    return `${(amountCents / 100).toFixed(2)} ${code}`;
  }
}

export interface MoneyByCurrency {
  currency: string;
  amountCents: number;
}

// Renders one amount per currency a user actually has completed
// payments in, joined with " + " — different currencies are NEVER added
// together into one number (e.g. £50 + $100 stays "£50 + $100", never
// "£150"). Almost always a single entry today since RepHear only
// processes USD, but this stays correct if a second currency is ever
// added.
export function formatMoneyBreakdown(amounts: MoneyByCurrency[]): string {
  if (amounts.length === 0) return formatMoney(0, "usd");
  return amounts.map((a) => formatMoney(a.amountCents, a.currency)).join(" + ");
}
