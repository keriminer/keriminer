import Stripe from "stripe";
import type { PaymentProvider, ProviderStatus } from "./types";
import { PaymentError } from "./types";

let client: Stripe | null = null;
export function stripe(): Stripe {
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY!);
  return client;
}

export const stripeProvider: PaymentProvider = {
  key: "stripe",
  label: "Carte internationale",
  description: "Visa, Mastercard, Apple Pay, Google Pay (diaspora et international)",
  methods: ["Visa", "Mastercard", "Apple Pay", "Google Pay"],
  currency: () => (process.env.STRIPE_CURRENCY ?? "EUR").toUpperCase(),
  enabled: () => !!process.env.STRIPE_SECRET_KEY,

  async createCheckout(order, ctx) {
    try {
      const session = await stripe().checkout.sessions.create({
        mode: "payment",
        client_reference_id: order.id,
        customer_email: ctx.user.email,
        locale: "fr",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: order.currency.toLowerCase(),
              unit_amount: order.amount,
              product_data: { name: `TwinShoot · ${order.credits} crédits` },
            },
          },
        ],
        metadata: { orderId: order.id, userId: ctx.user.id },
        payment_intent_data: { metadata: { orderId: order.id } },
        success_url: `${ctx.baseUrl}/billing/return?order=${order.id}`,
        cancel_url: `${ctx.baseUrl}/billing?cancelled=${order.id}`,
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
      });
      if (!session.url) throw new Error("URL de paiement absente");
      return { url: session.url, providerRef: session.id };
    } catch (err) {
      throw new PaymentError(`Stripe : ${(err as Error).message}`);
    }
  },

  async fetchStatus(order): Promise<ProviderStatus> {
    if (!order.providerRef) return { status: "pending" };
    const s = await stripe().checkout.sessions.retrieve(order.providerRef);
    const common = { amount: s.amount_total ?? undefined, currency: s.currency?.toUpperCase(), paymentMethod: "card" };
    if (s.payment_status === "paid" || s.payment_status === "no_payment_required") return { status: "paid", ...common };
    if (s.status === "expired") return { status: "failed", reason: "Session expirée", ...common };
    return { status: "pending", ...common };
  },
};
