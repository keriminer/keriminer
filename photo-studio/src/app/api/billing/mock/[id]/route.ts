import type { NextRequest } from "next/server";
import { ok, withUser } from "@/lib/api";
import { mockEnabled } from "@/lib/billing/providers/mock";
import { applyStatus, orderView, userOrder } from "@/lib/billing/service";
import { AppError } from "@/lib/errors";

export const POST = withUser(async (user, req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  if (!mockEnabled()) throw new AppError("not_found", "Indisponible.", 404);
  const order = await userOrder(user.id, (await ctx.params).id);
  if (!order || order.provider !== "mock") throw new AppError("not_found", "Commande introuvable.", 404);
  const { outcome } = (await req.json().catch(() => ({}))) as { outcome?: string };
  const updated = await applyStatus(order, outcome === "paid" ? { status: "paid", amount: order.amount, currency: order.currency } : { status: "failed", reason: "Paiement refusé (simulation)" });
  return ok({ order: orderView(updated) });
});
