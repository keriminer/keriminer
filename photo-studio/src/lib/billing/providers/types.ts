export type PaymentProviderKey = "paydunya" | "stripe" | "mock";

export interface OrderForProvider {
  id: string;
  packKey: string;
  credits: number;
  amount: number;
  currency: string;
  providerRef: string | null;
}

export interface CheckoutContext {
  user: { id: string; name: string; email: string };
  baseUrl: string;
  phone?: string;
  country?: string;
}

export interface ProviderStatus {
  status: "paid" | "failed" | "pending";
  amount?: number;
  currency?: string;
  paymentMethod?: string | null;
  reason?: string;
}

export interface PaymentProvider {
  key: PaymentProviderKey;
  label: string;
  description: string;
  methods: string[];
  currency: () => string;
  enabled: () => boolean;
  createCheckout(order: OrderForProvider, ctx: CheckoutContext): Promise<{ url: string; providerRef: string }>;
  fetchStatus(order: OrderForProvider): Promise<ProviderStatus>;
}

export class PaymentError extends Error {}
