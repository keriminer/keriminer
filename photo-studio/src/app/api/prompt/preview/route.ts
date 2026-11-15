import type { NextRequest } from "next/server";
import { ok, withUser } from "@/lib/api";
import { parseGenerateRequest, resolveGeneration } from "@/lib/generation";
import { getProfile } from "@/lib/repo";

export const POST = withUser(async (user, req: NextRequest) => {
  const parsed = parseGenerateRequest(await req.json().catch(() => null));
  const g = resolveGeneration(parsed, await getProfile(user.id));
  return ok({ prompt: g.prompt, twin: g.twin });
});
