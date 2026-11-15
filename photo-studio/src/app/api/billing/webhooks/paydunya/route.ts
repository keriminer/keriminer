import type { NextRequest } from "next/server";
import { dbReady } from "@/db";
import { verifyPaydunyaHash } from "@/lib/billing/providers/paydunya";
import { findOrderByRef, syncOrder } from "@/lib/billing/service";

/**
 * IPN PayDunya (POST x-www-form-urlencoded, champs sous data[...]).
 * Le contenu n'est jamais cru sur parole : on vérifie le hash, puis on redemande le statut à l'API PayDunya.
 */
export async function POST(req: NextRequest) {
  await dbReady;
  const form = await req.formData().catch(() => null);
  if (!form) return new Response("bad request", { status: 400 });
  const hash = (form.get("data[hash]") ?? form.get("hash")) as string | null;
  const token = (form.get("data[invoice][token]") ?? form.get("token")) as string | null;
  if (!verifyPaydunyaHash(hash)) {
    console.warn("[billing] IPN PayDunya rejeté : hash invalide");
    return new Response("invalid signature", { status: 401 });
  }
  if (!token) return new Response("missing token", { status: 400 });
  const order = await findOrderByRef("paydunya", token);
  if (!order) return new Response("ok", { status: 200 });
  await syncOrder(order);
  return new Response("ok", { status: 200 });
}
