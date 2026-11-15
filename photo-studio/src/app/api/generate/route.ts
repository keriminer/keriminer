import type { NextRequest } from "next/server";
import { jobView, ok, withUser } from "@/lib/api";
import { createJob, parseGenerateRequest } from "@/lib/generation";

export const POST = withUser(async (user, req: NextRequest) => {
  const job = await createJob(user.id, parseGenerateRequest(await req.json().catch(() => null)));
  return ok(jobView(job), 202);
});
