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
