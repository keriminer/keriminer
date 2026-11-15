import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Database, TwinProfile } from "./types";

const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR ?? "./data");
const DB_FILE = path.join(DATA_DIR, "db.json");
export const FILES_DIR = path.join(DATA_DIR, "files");

function defaultProfile(): TwinProfile {
  return {
    photos: [],
    primaryColor: null,
    secondaryColor: null,
    hair: { mode: "none", value: null },
    makeup: { mode: "none", value: null },
    credits: Number(process.env.STARTING_CREDITS ?? 20),
    updatedAt: new Date().toISOString(),
  };
}

let cache: Database | null = null;
let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<Database> {
  if (cache) return cache;
  await fs.mkdir(FILES_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    const parsed = JSON.parse(raw) as Database;
    cache = { profile: { ...defaultProfile(), ...parsed.profile }, media: parsed.media ?? [], jobs: parsed.jobs ?? [] };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    cache = { profile: defaultProfile(), media: [], jobs: [] };
  }
  return cache;
}

async function persist(db: Database): Promise<void> {
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2));
  await fs.rename(tmp, DB_FILE);
}

export async function read<T>(fn: (db: Database) => T): Promise<T> {
  await queue;
  return fn(structuredClone(await load()));
}

export function mutate<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = await load();
    const result = await fn(db);
    db.profile.updatedAt = new Date().toISOString();
    await persist(db);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/svg+xml": "svg" };

export async function saveFile(folder: "twin" | "media", data: Buffer, mimeType: string): Promise<string> {
  const ext = EXT[mimeType];
  if (!ext) throw new Error(`Type non supporté : ${mimeType}`);
  const rel = `${folder}/${randomUUID()}.${ext}`;
  await fs.mkdir(path.join(FILES_DIR, folder), { recursive: true });
  await fs.writeFile(path.join(FILES_DIR, rel), data);
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

export function fileUrl(rel: string): string {
  return `/api/files/${rel}`;
}
