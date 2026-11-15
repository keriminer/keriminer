import type { Metadata } from "next";
import { redirect } from "next/navigation";
import BillingPage from "@/components/BillingPage";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Crédits · TwinShoot Studio" };

export default async function Page() {
  if (!(await currentUser())) redirect("/login");
  return <BillingPage />;
}
