import { createHash, timingSafeEqual } from "node:crypto";
import type { PaymentProvider, ProviderStatus } from "./types";
import { PaymentError } from "./types";

const base = () =>
  (process.env.PAYDUNYA_BASE_URL ?? (process.env.PAYDUNYA_MODE === "live" ? "https://app.paydunya.com/api/v1" : "https://app.paydunya.com/sandbox-api/v1")).replace(/\/$/, "");

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "PAYDUNYA-MASTER-KEY": process.env.PAYDUNYA_MASTER_KEY ?? "",
    "PAYDUNYA-PRIVATE-KEY": process.env.PAYDUNYA_PRIVATE_KEY ?? "",
    "PAYDUNYA-TOKEN": process.env.PAYDUNYA_TOKEN ?? "",
  };
}

type PaydunyaResponse = {
  response_code?: string;
  response_text?: string;
  description?: string;
  token?: string;
  status?: string;
  hash?: string;
  fail_reason?: string;
  invoice?: { token?: string; total_amount?: number | string };
  customer?: { phone?: string };
};

async function call(path: string, init: RequestInit): Promise<PaydunyaResponse> {
  let res: Response;
  try {
    res = await fetch(`${base()}${path}`, { ...init, headers: headers(), signal: AbortSignal.timeout(20_000) });
  } catch (err) {
    throw new PaymentError(`PayDunya injoignable : ${(err as Error).message}`);
  }
  const data = (await res.json().catch(() => null)) as PaydunyaResponse | null;
  if (!data) throw new PaymentError(`Réponse PayDunya illisible (HTTP ${res.status})`);
  return data;
}

/** Le hash envoyé par PayDunya est le SHA-512 de la Master Key : il prouve que l'appel vient bien d'eux. */
export function verifyPaydunyaHash(hash: string | null | undefined): boolean {
  const key = process.env.PAYDUNYA_MASTER_KEY;
  if (!key || !hash) return false;
  const expected = Buffer.from(createHash("sha512").update(key).digest("hex"));
  const received = Buffer.from(hash.toLowerCase());
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export const paydunyaProvider: PaymentProvider = {
  key: "paydunya",
  label: "Mobile Money & carte locale",
  description: "Orange Money, Moov, MTN, Wave, Celtiis, cartes · Mali, Bénin, Côte d'Ivoire, Sénégal, Burkina, Togo…",
  methods: ["Orange Money", "Moov Money", "MTN MoMo", "Wave", "Celtiis Cash", "Visa / Mastercard"],
  currency: () => "XOF",
  enabled: () => !!(process.env.PAYDUNYA_MASTER_KEY && process.env.PAYDUNYA_PRIVATE_KEY && process.env.PAYDUNYA_TOKEN),

  async createCheckout(order, ctx) {
    const channels = process.env.PAYDUNYA_CHANNELS?.split(",").map((c) => c.trim()).filter(Boolean);
    const data = await call("/checkout-invoice/create", {
      method: "POST",
      body: JSON.stringify({
        invoice: {
          total_amount: order.amount,
          description: `TwinShoot · ${order.credits} crédits`,
          customer: { name: ctx.user.name, email: ctx.user.email, ...(ctx.phone ? { phone: ctx.phone } : {}) },
          ...(channels?.length ? { channels } : {}),
        },
        store: {
          name: process.env.PAYDUNYA_STORE_NAME ?? "TwinShoot Studio",
          website_url: ctx.baseUrl,
        },
        custom_data: { order_id: order.id, user_id: ctx.user.id },
        actions: {
          cancel_url: `${ctx.baseUrl}/billing?cancelled=${order.id}`,
          return_url: `${ctx.baseUrl}/billing/return?order=${order.id}`,
          callback_url: `${ctx.baseUrl}/api/billing/webhooks/paydunya`,
        },
      }),
    });
    if (data.response_code !== "00" || !data.token || !data.response_text?.startsWith("http")) {
      throw new PaymentError(`PayDunya a refusé la facture : ${data.response_text ?? data.description ?? data.response_code}`);
    }
    return { url: data.response_text, providerRef: data.token };
  },

  async fetchStatus(order): Promise<ProviderStatus> {
    if (!order.providerRef) return { status: "pending" };
    const data = await call(`/checkout-invoice/confirm/${encodeURIComponent(order.providerRef)}`, { method: "GET" });
    if (data.response_code !== "00") return { status: "pending", reason: data.response_text };
    const status = String(data.status ?? "").toLowerCase();
    const common = {
      amount: data.invoice?.total_amount !== undefined ? Number(data.invoice.total_amount) : undefined,
      currency: "XOF",
      paymentMethod: null,
    };
    if (status === "completed") return { status: "paid", ...common };
    if (status === "cancelled") return { status: "failed", reason: "Paiement annulé", ...common };
    if (status === "failed") return { status: "failed", reason: data.fail_reason || "Paiement refusé par l'opérateur", ...common };
    return { status: "pending", ...common };
  },
};
