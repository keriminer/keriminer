import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PaymentReturn from "@/components/PaymentReturn";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Paiement · TwinShoot Studio" };

export default async function Page({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  if (!(await currentUser())) redirect("/login");
  const { order } = await searchParams;
  if (!order) redirect("/billing");
  return <PaymentReturn orderId={order} />;
}
