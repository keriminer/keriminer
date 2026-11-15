import type { NextRequest } from "next/server";
import { jobView, mediaView, ok } from "@/lib/api";
import { read } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const result = await read((db) => {
    const job = db.jobs.find((j) => j.id === id);
    if (!job) return null;
    return { job, media: db.media.filter((m) => job.produced.includes(m.id)), credits: db.profile.credits };
  });
  if (!result) return ok({ error: "not_found", message: "Génération introuvable." }, 404);
  return ok({ ...jobView(result.job), media: result.media.map(mediaView), credits: result.credits });
}
