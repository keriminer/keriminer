import { notFound, redirect } from "next/navigation";
import MockCheckout from "@/components/MockCheckout";
import { currentUser } from "@/lib/auth";
import { mockEnabled } from "@/lib/billing/providers/mock";
import { formatPrice } from "@/lib/billing/packs";
import { userOrder } from "@/lib/billing/service";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  if (!mockEnabled()) notFound();
  const user = await currentUser();
  if (!user) redirect("/login");
  const { order: id } = await searchParams;
  const order = id ? await userOrder(user.id, id) : undefined;
  if (!order || order.provider !== "mock") notFound();
  return <MockCheckout orderId={order.id} credits={order.credits} amount={formatPrice(order.amount, order.currency)} />;
}
