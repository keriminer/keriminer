import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const FILES_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR ?? "./data", "files");

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/svg+xml": "svg" };

export function userPrefix(userId: string): string {
  return `users/${userId}/`;
}

export async function saveFile(userId: string, folder: "twin" | "media", data: Buffer, mimeType: string): Promise<string> {
  const ext = EXT[mimeType];
  if (!ext) throw new Error(`Type non supporté : ${mimeType}`);
  const rel = `${userPrefix(userId)}${folder}/${randomUUID()}.${ext}`;
  const abs = resolveFile(rel)!;
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, data);
  return rel;
}

export function resolveFile(rel: string): string | null {
  const abs = path.resolve(/*turbopackIgnore: true*/ FILES_DIR, rel);
  return abs.startsWith(FILES_DIR + path.sep) ? abs : null;
}

export async function readFileBase64(rel: string): Promise<string> {
  const abs = resolveFile(rel);
  if (!abs) throw new Error("Chemin invalide");
  return (await fs.readFile(abs)).toString("base64");
}

export async function deleteFile(rel: string): Promise<void> {
  const abs = resolveFile(rel);
  if (abs) await fs.rm(abs, { force: true });
}

export async function deleteUserFiles(userId: string): Promise<void> {
  const abs = resolveFile(userPrefix(userId));
  if (abs) await fs.rm(abs, { recursive: true, force: true });
}

export function fileUrl(rel: string): string {
  return `/api/files/${rel}`;
}
