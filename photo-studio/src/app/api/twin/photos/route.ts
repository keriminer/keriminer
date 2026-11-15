import type { NextRequest } from "next/server";
import { ok, profileView, withUser } from "@/lib/api";
import { ACCEPTED_MIME, ANGLES, MAX_UPLOAD_BYTES } from "@/lib/catalog";
import { AppError } from "@/lib/errors";
import { deletePhoto, getProfile, upsertPhoto } from "@/lib/repo";
import { saveFile } from "@/lib/storage";
import type { AngleKey, TwinKind } from "@/lib/types";

export const POST = withUser(async (user, req: NextRequest) => {
  const profile = await getProfile(user.id);
  if (!profile.consentedAt) throw new AppError("consent_required", "Acceptez l'utilisation de vos photos avant de les importer.", 403);
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

  const rel = await saveFile(user.id, "twin", Buffer.from(await file.arrayBuffer()), file.type);
  await upsertPhoto(user.id, { kind, angle, file: rel, mimeType: file.type });
  return ok(profileView(await getProfile(user.id), user), 201);
});

export const DELETE = withUser(async (user, req: NextRequest) => {
  await deletePhoto(user.id, req.nextUrl.searchParams.get("id") ?? "");
  return ok(profileView(await getProfile(user.id), user));
});
