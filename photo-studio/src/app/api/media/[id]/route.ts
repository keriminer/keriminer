import type { NextRequest } from "next/server";
import { handleError, mediaView, ok } from "@/lib/api";
import { AppError } from "@/lib/generation";
import { deleteFile, mutate } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { favorite } = (await req.json()) as { favorite?: unknown };
    if (typeof favorite !== "boolean") throw new AppError("invalid_request", "Valeur invalide.");
    const item = await mutate((db) => {
      const m = db.media.find((x) => x.id === id);
      if (!m) throw new AppError("not_found", "Photo introuvable.", 404);
      m.favorite = favorite;
      return structuredClone(m);
    });
    return ok(mediaView(item));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const file = await mutate((db) => {
      const m = db.media.find((x) => x.id === id);
      if (!m) throw new AppError("not_found", "Photo introuvable.", 404);
      db.media = db.media.filter((x) => x.id !== id);
      return m.file;
    });
    await deleteFile(file);
    return ok({ deleted: id });
  } catch (err) {
    return handleError(err);
  }
}
