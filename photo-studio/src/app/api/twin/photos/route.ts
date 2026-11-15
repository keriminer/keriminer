import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { handleError, ok, profileView } from "@/lib/api";
import { ACCEPTED_MIME, ANGLES, MAX_UPLOAD_BYTES } from "@/lib/catalog";
import { AppError } from "@/lib/generation";
import { deleteFile, mutate, saveFile } from "@/lib/store";
import type { AngleKey, TwinKind } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const kind = form.get("kind") as TwinKind;
    const angle = form.get("angle") as AngleKey;
    if (kind !== "smiling" && kind !== "neutral") throw new AppError("invalid_request", "Type de jumelle invalide.");
    if (!ANGLES.some((a) => a.key === angle)) throw new AppError("invalid_request", "Angle invalide.");
    if (!(file instanceof File)) throw new AppError("invalid_request", "Aucun fichier reçu.");
    if (!(ACCEPTED_MIME as readonly string[]).includes(file.type)) {
      throw new AppError("unsupported_file", "Formats acceptés : JPG, PNG, WebP. Sur iPhone, exportez en JPG (Réglages › Appareil photo › Formats › Le plus compatible).");
    }
    if (file.size > MAX_UPLOAD_BYTES) throw new AppError("file_too_large", "Photo trop lourde (10 Mo max).", 413);

    const rel = await saveFile("twin", Buffer.from(await file.arrayBuffer()), file.type);
    const { profile, replaced } = await mutate((db) => {
      const old = db.profile.photos.find((p) => p.kind === kind && p.angle === angle);
      db.profile.photos = db.profile.photos.filter((p) => p !== old);
      db.profile.photos.push({ id: randomUUID(), kind, angle, file: rel, mimeType: file.type, createdAt: new Date().toISOString() });
      return { profile: structuredClone(db.profile), replaced: old?.file };
    });
    if (replaced) await deleteFile(replaced);
    return ok(profileView(profile), 201);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    const { profile, removed } = await mutate((db) => {
      const target = db.profile.photos.find((p) => p.id === id);
      if (!target) throw new AppError("not_found", "Photo introuvable.", 404);
      db.profile.photos = db.profile.photos.filter((p) => p.id !== id);
      return { profile: structuredClone(db.profile), removed: target.file };
    });
    await deleteFile(removed);
    return ok(profileView(profile));
  } catch (err) {
    return handleError(err);
  }
}
