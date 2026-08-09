// Configurable Reputation Credit packages. Exchange rate: 1 USD = 10
// Reputation Credits (Product Owner decision). Adding, removing, or
// re-pricing a package only requires editing this file — nothing else
// needs to change.

export interface CreditPackage {
  id: string;
  credits: number;
  priceCents: number;
  label: string;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: "starter", credits: 50, priceCents: 500, label: "50 Reputation Credits" },
  { id: "supporter", credits: 100, priceCents: 1000, label: "100 Reputation Credits" },
  { id: "champion", credits: 250, priceCents: 2500, label: "250 Reputation Credits" },
  { id: "patron", credits: 500, priceCents: 5000, label: "500 Reputation Credits" },
];

export function findCreditPackage(id: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((p) => p.id === id);
}

// Same exchange rate the fixed packages above use, exported so the
// "Custom amount" option (SupportPackages.tsx / api/checkout) computes
// Credits the exact same way instead of hardcoding "10" a second time.
export const CREDITS_PER_DOLLAR = 10;

// Whole-dollar bounds for a custom Support amount. Minimum keeps every
// charge comfortably above Stripe's own $0.50 minimum; maximum is a
// sanity ceiling against a fat-fingered extra zero, not a real spending
// limit — someone who genuinely wants to give more can just submit the
// form again.
export const CUSTOM_AMOUNT_MIN_DOLLARS = 1;
export const CUSTOM_AMOUNT_MAX_DOLLARS = 1000;

export const CUSTOM_PACKAGE_ID = "custom";
