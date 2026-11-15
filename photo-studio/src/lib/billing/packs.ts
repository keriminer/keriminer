export interface CreditPack {
  key: string;
  name: string;
  credits: number;
  highlight?: string;
  prices: Record<string, number>;
}

/** Montants dans la plus petite unité : XOF/XAF sans décimales (multiples de 5), EUR/USD en centimes. */
export const CREDIT_PACKS: CreditPack[] = [
  { key: "starter", name: "Découverte", credits: 10, prices: { XOF: 2500, XAF: 2500, EUR: 400, USD: 450 } },
  { key: "pro", name: "Pro", credits: 40, highlight: "Le plus choisi", prices: { XOF: 7500, XAF: 7500, EUR: 1200, USD: 1350 } },
  { key: "studio", name: "Studio", credits: 100, highlight: "Meilleur prix par photo", prices: { XOF: 15000, XAF: 15000, EUR: 2400, USD: 2700 } },
];

const ZERO_DECIMAL = new Set(["XOF", "XAF", "GNF", "CDF"]);

export function toMajor(amount: number, currency: string): number {
  return ZERO_DECIMAL.has(currency) ? amount : amount / 100;
}

export function formatPrice(amount: number, currency: string): string {
  const label = currency === "XOF" || currency === "XAF" ? "FCFA" : currency;
  const value = toMajor(amount, currency).toLocaleString("fr-FR", { minimumFractionDigits: ZERO_DECIMAL.has(currency) ? 0 : 2, maximumFractionDigits: 2 });
  return currency === "EUR" ? `${value} €` : `${value} ${label}`;
}

export function findPack(key: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.key === key);
}
