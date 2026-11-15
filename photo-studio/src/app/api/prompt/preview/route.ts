import type { NextRequest } from "next/server";
import { handleError, ok } from "@/lib/api";
import { parseGenerateRequest, resolveGeneration } from "@/lib/generation";
import { read } from "@/lib/store";

export async function POST(req: NextRequest) {
  try {
    const parsed = parseGenerateRequest(await req.json());
    const profile = await read((db) => db.profile);
    const g = resolveGeneration(parsed, profile);
    return ok({ prompt: g.prompt, twin: g.twin });
  } catch (err) {
    return handleError(err);
  }
}
