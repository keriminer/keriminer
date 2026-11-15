import type { PaymentProvider } from "./types";

export const mockEnabled = () => process.env.PAYMENT_MOCK === "force" || (process.env.PAYMENT_MOCK === "true" && process.env.NODE_ENV !== "production");

export const mockProvider: PaymentProvider = {
  key: "mock",
  label: "Paiement de test",
  description: "Simule un paiement Mobile Money (développement uniquement)",
  methods: ["Simulation"],
  currency: () => "XOF",
  enabled: mockEnabled,
  async createCheckout(order, ctx) {
    return { url: `${ctx.baseUrl}/billing/mock?order=${order.id}`, providerRef: `mock_${order.id}` };
  },
  async fetchStatus() {
    return { status: "pending" };
  },
};
