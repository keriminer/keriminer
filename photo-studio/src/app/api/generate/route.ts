import type { NextRequest } from "next/server";
import { handleError, jobView, ok } from "@/lib/api";
import { createJob, parseGenerateRequest } from "@/lib/generation";

export async function POST(req: NextRequest) {
  try {
    const job = await createJob(parseGenerateRequest(await req.json()));
    return ok(jobView(job), 202);
  } catch (err) {
    return handleError(err);
  }
}
