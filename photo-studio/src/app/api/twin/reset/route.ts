import type { NextRequest } from "next/server";
import { handleError, ok, profileView } from "@/lib/api";
import { AppError } from "@/lib/generation";
import { deleteFile, mutate } from "@/lib/store";

export async function POST(req: NextRequest) {
  try {
    const { kind } = (await req.json()) as { kind?: string };
    if (kind !== "smiling" && kind !== "neutral") throw new AppError("invalid_request", "Type de jumelle invalide.");
    const { profile, files } = await mutate((db) => {
      const files = db.profile.photos.filter((p) => p.kind === kind).map((p) => p.file);
      db.profile.photos = db.profile.photos.filter((p) => p.kind !== kind);
      return { profile: structuredClone(db.profile), files };
    });
    await Promise.all(files.map(deleteFile));
    return ok(profileView(profile));
  } catch (err) {
    return handleError(err);
  }
}
