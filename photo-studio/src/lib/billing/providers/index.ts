import { paydunyaProvider } from "./paydunya";
import { mockProvider } from "./mock";
import { stripeProvider } from "./stripe";
import type { PaymentProvider, PaymentProviderKey } from "./types";

const ALL: PaymentProvider[] = [paydunyaProvider, stripeProvider, mockProvider];

export function enabledProviders(): PaymentProvider[] {
  return ALL.filter((p) => p.enabled());
}

export function getPaymentProvider(key: string): PaymentProvider | undefined {
  return ALL.find((p) => p.key === (key as PaymentProviderKey));
}

export * from "./types";
