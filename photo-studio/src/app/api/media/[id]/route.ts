import type { NextRequest } from "next/server";
import { mediaView, ok, withUser } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { deleteMedia, setFavorite } from "@/lib/repo";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withUser(async (user, req: NextRequest, ctx: Ctx) => {
  const { favorite } = (await req.json().catch(() => ({}))) as { favorite?: unknown };
  if (typeof favorite !== "boolean") throw new AppError("invalid_request", "Valeur invalide.");
  return ok(mediaView(await setFavorite(user.id, (await ctx.params).id, favorite)));
});

export const DELETE = withUser(async (user, _req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  await deleteMedia(user.id, id);
  return ok({ deleted: id });
});
