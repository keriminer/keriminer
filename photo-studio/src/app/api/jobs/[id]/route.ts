import type { NextRequest } from "next/server";
import { jobView, mediaView, ok, withUser } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { getJobWithMedia } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const GET = withUser(async (user, _req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const result = await getJobWithMedia(user.id, (await ctx.params).id);
  if (!result) throw new AppError("not_found", "Génération introuvable.", 404);
  return ok({ ...jobView(result.job), media: result.media.map(mediaView), credits: result.credits });
});
