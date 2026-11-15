import { randomUUID } from "node:crypto";
import { and, count as sqlCount, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { MAX_PENDING_JOBS, MAX_PHOTOS_PER_JOB, findCollection, twinForEnergy } from "./catalog";
import { AppError } from "./errors";
import { buildCollectionPrompt, buildCustomPrompt } from "./prompt";
import { getProvider, ProviderError, type ReferenceImage } from "./providers";
import { getProfile } from "./repo";
import { readFileBase64, saveFile } from "./storage";
import type { AspectRatio, GenerationInfo, TwinKind, TwinProfile } from "./types";

export { AppError };

const { job, media, twinProfile, twinPhoto, creditLedger } = schema;

export interface GenerateRequest {
  mode: "collection" | "custom";
  collectionKey?: string;
  customPrompt?: string;
  twin?: TwinKind;
  aspectRatio: AspectRatio;
  count: number;
}

const RATIOS: AspectRatio[] = ["4:5", "9:16", "1:1", "16:9"];

export function parseGenerateRequest(body: unknown): GenerateRequest {
  const b = (body ?? {}) as Record<string, unknown>;
  const mode = b.mode === "custom" ? "custom" : b.mode === "collection" ? "collection" : null;
  if (!mode) throw new AppError("invalid_request", "Mode de génération invalide.");
  const aspectRatio = RATIOS.includes(b.aspectRatio as AspectRatio) ? (b.aspectRatio as AspectRatio) : null;
  if (!aspectRatio) throw new AppError("invalid_request", "Format d'image invalide.");
  const count = Number(b.count);
  if (!Number.isInteger(count) || count < 1 || count > MAX_PHOTOS_PER_JOB) {
    throw new AppError("invalid_request", `Nombre de photos entre 1 et ${MAX_PHOTOS_PER_JOB}.`);
  }
  const twin = b.twin === "neutral" ? "neutral" : b.twin === "smiling" ? "smiling" : undefined;
  if (mode === "collection") {
    if (typeof b.collectionKey !== "string" || !findCollection(b.collectionKey)) {
      throw new AppError("invalid_request", "Collection inconnue.");
    }
    return { mode, collectionKey: b.collectionKey, aspectRatio, count, twin };
  }
  const customPrompt = typeof b.customPrompt === "string" ? b.customPrompt.trim() : "";
  if (customPrompt.length < 15) throw new AppError("invalid_request", "Décrivez la scène en au moins 15 caractères.");
  if (customPrompt.length > 2000) throw new AppError("invalid_request", "Description trop longue (2000 caractères max).");
  return { mode, customPrompt, aspectRatio, count, twin: twin ?? "smiling" };
}

function pickTwin(profile: TwinProfile, wanted: TwinKind): TwinKind {
  const has = (k: TwinKind) => profile.photos.some((p) => p.kind === k && p.angle === "front");
  if (has(wanted)) return wanted;
  if (has("smiling")) return "smiling";
  if (has("neutral")) return "neutral";
  throw new AppError("twin_missing", "Ajoutez au moins votre photo de face pour créer votre jumelle IA.");
}

export function resolveGeneration(req: GenerateRequest, profile: TwinProfile): GenerationInfo {
  if (req.mode === "collection") {
    const c = findCollection(req.collectionKey!)!;
    const twin = pickTwin(profile, req.twin ?? twinForEnergy(c.energy));
    return {
      mode: "collection",
      intent: c.intent,
      collectionKey: c.key,
      collectionName: c.name,
      twin,
      aspectRatio: req.aspectRatio,
      prompt: buildCollectionPrompt({ collection: c, twin, profile, aspectRatio: req.aspectRatio }),
    };
  }
  const twin = pickTwin(profile, req.twin ?? "smiling");
  return {
    mode: "custom",
    intent: null,
    collectionKey: null,
    collectionName: null,
    twin,
    aspectRatio: req.aspectRatio,
    prompt: buildCustomPrompt({ userPrompt: req.customPrompt!, twin, profile, aspectRatio: req.aspectRatio }),
  };
}

export async function createJob(userId: string, req: GenerateRequest) {
  await recoverStaleJobs();
  const profile = await getProfile(userId);
  const generation = resolveGeneration(req, profile);
  const id = randomUUID();

  const created = await db.transaction(async (tx) => {
    const [locked] = await tx.select({ credits: twinProfile.credits }).from(twinProfile).where(eq(twinProfile.userId, userId)).for("update");
    const [{ pending }] = await tx
      .select({ pending: sqlCount() })
      .from(job)
      .where(and(eq(job.userId, userId), inArray(job.status, ["queued", "running"])));
    if (pending >= MAX_PENDING_JOBS) {
      throw new AppError("too_many_pending_jobs", `${MAX_PENDING_JOBS} générations sont déjà en cours. Patientez quelques instants.`, 429);
    }
    if (!locked || locked.credits < req.count) {
      const available = locked?.credits ?? 0;
      throw new AppError("not_enough_credits", `Il vous faut ${req.count} crédit(s), il vous en reste ${available}.`, 402, { needed: req.count, available });
    }
    await tx.update(twinProfile).set({ credits: sql`${twinProfile.credits} - ${req.count}` }).where(eq(twinProfile.userId, userId));
    await tx.insert(creditLedger).values({ id: randomUUID(), userId, delta: -req.count, reason: "generation", jobId: id });
    const [row] = await tx.insert(job).values({ id, userId, status: "queued", count: req.count, generation }).returning();
    return row;
  });

  void runJob(created.id, userId);
  return created;
}

async function referencesFor(userId: string, twin: TwinKind): Promise<ReferenceImage[]> {
  const photos = await db
    .select()
    .from(twinPhoto)
    .where(and(eq(twinPhoto.userId, userId), eq(twinPhoto.kind, twin)));
  const order = ["front", "right45", "profile", "fullbody"];
  photos.sort((a, b) => order.indexOf(a.angle) - order.indexOf(b.angle));
  return Promise.all(photos.map(async (p) => ({ mimeType: p.mimeType, base64: await readFileBase64(p.file) })));
}

async function finishJob(jobId: string, userId: string, produced: number, total: number, error: string | null) {
  await db.transaction(async (tx) => {
    const missing = total - produced;
    if (missing > 0) {
      await tx.update(twinProfile).set({ credits: sql`${twinProfile.credits} + ${missing}` }).where(eq(twinProfile.userId, userId));
      await tx.insert(creditLedger).values({ id: randomUUID(), userId, delta: missing, reason: "refund", jobId });
    }
    await tx
      .update(job)
      .set({ status: produced > 0 ? "complete" : "failed", produced, error, finishedAt: new Date() })
      .where(eq(job.id, jobId));
  });
}

async function runJob(jobId: string, userId: string): Promise<void> {
  const [row] = await db.update(job).set({ status: "running" }).where(eq(job.id, jobId)).returning();
  if (!row) return;

  let produced = 0;
  let lastError: ProviderError | null = null;
  try {
    const provider = getProvider();
    const references = await referencesFor(userId, row.generation.twin);
    for (let i = 0; i < row.count; i++) {
      try {
        const img = await provider.generate({ prompt: row.generation.prompt, references, aspectRatio: row.generation.aspectRatio });
        const file = await saveFile(userId, "media", img.data, img.mimeType);
        await db.insert(media).values({ id: randomUUID(), userId, jobId, file, mimeType: img.mimeType, generation: row.generation });
        produced++;
        await db.update(job).set({ produced }).where(eq(job.id, jobId));
      } catch (err) {
        lastError = err instanceof ProviderError ? err : new ProviderError(String(err), "provider_error");
        console.error(`[job ${jobId}] image ${i + 1}/${row.count} :`, lastError.message);
      }
    }
  } catch (err) {
    lastError = err instanceof ProviderError ? err : new ProviderError(String(err), "provider_error");
  }
  await finishJob(jobId, userId, produced, row.count, lastError ? `${lastError.code}: ${lastError.message}` : null);
}

let recovered: Promise<void> | null = null;
function recoverStaleJobs(): Promise<void> {
  recovered ??= (async () => {
    const stale = await db
      .select({ id: job.id, userId: job.userId, count: job.count, produced: job.produced })
      .from(job)
      .where(inArray(job.status, ["queued", "running"]));
    for (const j of stale) {
      await finishJob(j.id, j.userId, j.produced, j.count, "provider_error: interrompu par un redémarrage du serveur");
    }
  })();
  return recovered;
}
