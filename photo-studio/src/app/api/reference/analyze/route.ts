import type { NextRequest } from "next/server";
import { handleError, ok } from "@/lib/api";
import { ACCEPTED_MIME, MAX_UPLOAD_BYTES } from "@/lib/catalog";
import { AppError } from "@/lib/generation";
import { getProvider } from "@/lib/providers";

export async function POST(req: NextRequest) {
  try {
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) throw new AppError("invalid_request", "Aucune photo reçue.");
    if (!(ACCEPTED_MIME as readonly string[]).includes(file.type)) throw new AppError("unsupported_file", "Formats acceptés : JPG, PNG, WebP.");
    if (file.size > MAX_UPLOAD_BYTES) throw new AppError("file_too_large", "Photo trop lourde (10 Mo max).", 413);
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    return ok(await getProvider().analyzeReference({ mimeType: file.type, base64 }));
  } catch (err) {
    return handleError(err);
  }
}
