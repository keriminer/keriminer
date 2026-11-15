import type { NextRequest } from "next/server";
import type Stripe from "stripe";
import { dbReady } from "@/db";
import { stripe } from "@/lib/billing/providers/stripe";
import { findOrder, syncOrder } from "@/lib/billing/service";

const HANDLED = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"]);

export async function POST(req: NextRequest) {
  await dbReady;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) return new Response("not configured", { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return new Response("invalid signature", { status: 400 });
  }
  if (HANDLED.has(event.type)) {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId ?? session.client_reference_id;
    const order = orderId ? await findOrder(orderId) : undefined;
    if (order && order.provider === "stripe" && order.providerRef === session.id) await syncOrder(order);
  }
  return new Response("ok", { status: 200 });
}
