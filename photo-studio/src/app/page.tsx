import { redirect } from "next/navigation";
import Studio from "@/components/Studio";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!(await currentUser())) redirect("/login");
  return <Studio />;
}
