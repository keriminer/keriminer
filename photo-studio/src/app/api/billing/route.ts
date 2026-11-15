import { ok, withUser } from "@/lib/api";
import { billingCatalog, listOrders, orderView } from "@/lib/billing/service";
import { getProfile } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const GET = withUser(async (user) => {
  const [orders, profile] = await Promise.all([listOrders(user.id), getProfile(user.id)]);
  return ok({ ...billingCatalog(), orders: orders.map(orderView), credits: profile.credits });
});
