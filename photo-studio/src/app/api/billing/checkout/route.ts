import type { NextRequest } from "next/server";
import { ok, withUser } from "@/lib/api";
import { createCheckout } from "@/lib/billing/service";

export const POST = withUser(async (user, req: NextRequest) => {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return ok(await createCheckout(user, { packKey: body.packKey, provider: body.provider, phone: body.phone }), 201);
});
