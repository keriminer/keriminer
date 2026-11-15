import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { AppError } from "../errors";
import { CREDIT_PACKS, findPack, formatPrice } from "./packs";
import { enabledProviders, getPaymentProvider, PaymentError, type ProviderStatus } from "./providers";

const { paymentOrder, twinProfile, creditLedger } = schema;
type Order = typeof paymentOrder.$inferSelect;

const MAX_PENDING_PER_HOUR = 5;
const ORDER_TTL_MS = 24 * 60 * 60 * 1000;

export function appBaseUrl(): string {
  return (process.env.APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function billingCatalog() {
  return {
    providers: enabledProviders().map((p) => ({ key: p.key, label: p.label, description: p.description, methods: p.methods, currency: p.currency() })),
    packs: CREDIT_PACKS.map((pack) => ({
      key: pack.key,
      name: pack.name,
      credits: pack.credits,
      highlight: pack.highlight ?? null,
      prices: Object.fromEntries(enabledProviders().map((p) => [p.key, { amount: pack.prices[p.currency()], label: formatPrice(pack.prices[p.currency()], p.currency()) }])),
    })),
  };
}

export function orderView(o: Order) {
  return {
    id: o.id,
    provider: o.provider,
    packKey: o.packKey,
    credits: o.credits,
    amountLabel: formatPrice(o.amount, o.currency),
    status: o.status,
    failureReason: o.failureReason,
    createdAt: o.createdAt.toISOString(),
    paidAt: o.paidAt?.toISOString() ?? null,
  };
}

export async function createCheckout(
  user: { id: string; name: string; email: string },
  input: { packKey: unknown; provider: unknown; phone?: unknown },
): Promise<{ orderId: string; url: string }> {
  const pack = typeof input.packKey === "string" ? findPack(input.packKey) : undefined;
  if (!pack) throw new AppError("invalid_request", "Pack de crédits inconnu.");
  const provider = typeof input.provider === "string" ? getPaymentProvider(input.provider) : undefined;
  if (!provider || !provider.enabled()) throw new AppError("invalid_request", "Moyen de paiement indisponible.");
  const currency = provider.currency();
  const amount = pack.prices[currency];
  if (!amount) throw new AppError("invalid_request", `Ce pack n'est pas disponible en ${currency}.`);
  const phone = typeof input.phone === "string" && /^\+?[0-9 ]{8,16}$/.test(input.phone.trim()) ? input.phone.replace(/\s/g, "") : undefined;

  const [{ recent }] = await db
    .select({ recent: sql<number>`count(*)::int` })
    .from(paymentOrder)
    .where(and(eq(paymentOrder.userId, user.id), eq(paymentOrder.status, "pending"), gte(paymentOrder.createdAt, new Date(Date.now() - 60 * 60 * 1000))));
  if (recent >= MAX_PENDING_PER_HOUR) {
    throw new AppError("too_many_pending_jobs", "Trop de paiements en attente. Finalisez-les ou réessayez dans une heure.", 429);
  }

  const id = randomUUID();
  await db.insert(paymentOrder).values({ id, userId: user.id, provider: provider.key, packKey: pack.key, credits: pack.credits, amount, currency });
  try {
    const { url, providerRef } = await provider.createCheckout(
      { id, packKey: pack.key, credits: pack.credits, amount, currency, providerRef: null },
      { user, baseUrl: appBaseUrl(), phone },
    );
    await db.update(paymentOrder).set({ providerRef }).where(eq(paymentOrder.id, id));
    return { orderId: id, url };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await db.update(paymentOrder).set({ status: "failed", failureReason: reason.slice(0, 300) }).where(eq(paymentOrder.id, id));
    console.error(`[billing] création ${provider.key} échouée :`, reason);
    throw new AppError("provider_error", "Le service de paiement est momentanément indisponible. Réessayez dans quelques minutes.", 502);
  }
}

/** Applique un statut vérifié auprès du fournisseur. Idempotent : un paiement ne crédite qu'une seule fois. */
export async function applyStatus(order: Order, s: ProviderStatus): Promise<Order> {
  if (order.status !== "pending") return order;

  if (s.status === "paid") {
    const amountOk = s.amount === undefined || s.amount === order.amount;
    const currencyOk = !s.currency || s.currency === order.currency;
    if (!amountOk || !currencyOk) {
      console.error(`[billing] montant incohérent pour ${order.id} : reçu ${s.amount} ${s.currency}, attendu ${order.amount} ${order.currency}`);
      const [row] = await db
        .update(paymentOrder)
        .set({ status: "failed", failureReason: "Montant reçu incohérent : contactez le support." })
        .where(and(eq(paymentOrder.id, order.id), eq(paymentOrder.status, "pending")))
        .returning();
      return row ?? order;
    }
    return db.transaction(async (tx) => {
      const [row] = await tx
        .update(paymentOrder)
        .set({ status: "paid", paidAt: new Date(), paymentMethod: s.paymentMethod ?? null })
        .where(and(eq(paymentOrder.id, order.id), eq(paymentOrder.status, "pending")))
        .returning();
      if (!row) return (await tx.query.paymentOrder.findFirst({ where: eq(paymentOrder.id, order.id) }))!;
      await tx.update(twinProfile).set({ credits: sql`${twinProfile.credits} + ${row.credits}` }).where(eq(twinProfile.userId, row.userId));
      await tx.insert(creditLedger).values({ id: randomUUID(), userId: row.userId, delta: row.credits, reason: "purchase", jobId: row.id });
      return row;
    });
  }

  const expired = Date.now() - order.createdAt.getTime() > ORDER_TTL_MS;
  if (s.status === "failed" || expired) {
    const [row] = await db
      .update(paymentOrder)
      .set({ status: s.status === "failed" ? "failed" : "cancelled", failureReason: (s.reason ?? "Délai de paiement dépassé").slice(0, 300) })
      .where(and(eq(paymentOrder.id, order.id), eq(paymentOrder.status, "pending")))
      .returning();
    return row ?? order;
  }
  return order;
}

/** Interroge le fournisseur (source de vérité) puis applique le statut. */
export async function syncOrder(order: Order): Promise<Order> {
  if (order.status !== "pending") return order;
  const provider = getPaymentProvider(order.provider);
  if (!provider || !provider.enabled()) return order;
  try {
    return await applyStatus(order, await provider.fetchStatus(order));
  } catch (err) {
    if (err instanceof PaymentError) console.error(`[billing] vérification ${order.id} :`, err.message);
    else throw err;
    return order;
  }
}

export async function findOrderByRef(provider: Order["provider"], ref: string): Promise<Order | undefined> {
  return db.query.paymentOrder.findFirst({ where: and(eq(paymentOrder.provider, provider), eq(paymentOrder.providerRef, ref)) });
}

export async function findOrder(id: string): Promise<Order | undefined> {
  return db.query.paymentOrder.findFirst({ where: eq(paymentOrder.id, id) });
}

export async function userOrder(userId: string, id: string): Promise<Order | undefined> {
  return db.query.paymentOrder.findFirst({ where: and(eq(paymentOrder.id, id), eq(paymentOrder.userId, userId)) });
}

export async function listOrders(userId: string) {
  return db.select().from(paymentOrder).where(eq(paymentOrder.userId, userId)).orderBy(desc(paymentOrder.createdAt)).limit(50);
}
