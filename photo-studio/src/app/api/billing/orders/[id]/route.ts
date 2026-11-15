import type { NextRequest } from "next/server";
import { ok, withUser } from "@/lib/api";
import { orderView, syncOrder, userOrder } from "@/lib/billing/service";
import { AppError } from "@/lib/errors";
import { getProfile } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const GET = withUser(async (user, _req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const order = await userOrder(user.id, (await ctx.params).id);
  if (!order) throw new AppError("not_found", "Commande introuvable.", 404);
  const synced = await syncOrder(order);
  return ok({ order: orderView(synced), credits: (await getProfile(user.id)).credits });
});
