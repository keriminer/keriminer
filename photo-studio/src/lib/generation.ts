import { randomUUID } from "node:crypto";
import { MAX_PENDING_JOBS, MAX_PHOTOS_PER_JOB, findCollection, twinForEnergy } from "./catalog";
import { buildCollectionPrompt, buildCustomPrompt } from "./prompt";
import { getProvider, ProviderError, type ReferenceImage } from "./providers";
import { mutate, read, readFileBase64, saveFile } from "./store";
import type { ApiErrorCode, AspectRatio, GenerationInfo, Job, TwinKind, TwinProfile } from "./types";

export class AppError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status = 400,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

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

export async function createJob(req: GenerateRequest): Promise<Job> {
  await recoverStaleJobs();
  const job = await mutate((db) => {
    const pending = db.jobs.filter((j) => j.status === "queued" || j.status === "running").length;
    if (pending >= MAX_PENDING_JOBS) {
      throw new AppError("too_many_pending_jobs", `${MAX_PENDING_JOBS} générations sont déjà en cours. Patientez quelques instants.`, 429);
    }
    if (db.profile.credits < req.count) {
      throw new AppError("not_enough_credits", `Il vous faut ${req.count} crédit(s), il vous en reste ${db.profile.credits}.`, 402, {
        needed: req.count,
        available: db.profile.credits,
      });
    }
    const generation = resolveGeneration(req, db.profile);
    db.profile.credits -= req.count;
    const created: Job = {
      id: randomUUID(),
      status: "queued",
      count: req.count,
      produced: [],
      error: null,
      createdAt: new Date().toISOString(),
      finishedAt: null,
      generation,
    };
    db.jobs.unshift(created);
    db.jobs = db.jobs.slice(0, 200);
    return created;
  });
  void runJob(job.id);
  return job;
}

async function referencesFor(twin: TwinKind): Promise<ReferenceImage[]> {
  const photos = await read((db) => db.profile.photos.filter((p) => p.kind === twin));
  const order = ["front", "right45", "profile", "fullbody"];
  photos.sort((a, b) => order.indexOf(a.angle) - order.indexOf(b.angle));
  return Promise.all(photos.map(async (p) => ({ mimeType: p.mimeType, base64: await readFileBase64(p.file) })));
}

async function runJob(jobId: string): Promise<void> {
  const job = await mutate((db) => {
    const j = db.jobs.find((x) => x.id === jobId);
    if (j) j.status = "running";
    return j ? structuredClone(j) : null;
  });
  if (!job) return;

  let lastError: ProviderError | null = null;
  try {
    const provider = getProvider();
    const references = await referencesFor(job.generation.twin);
    for (let i = 0; i < job.count; i++) {
      try {
        const img = await provider.generate({ prompt: job.generation.prompt, references, aspectRatio: job.generation.aspectRatio });
        const file = await saveFile("media", img.data, img.mimeType);
        await mutate((db) => {
          const mediaId = randomUUID();
          db.media.unshift({
            id: mediaId,
            file,
            mimeType: img.mimeType,
            createdAt: new Date().toISOString(),
            favorite: false,
            jobId,
            generation: job.generation,
          });
          db.jobs.find((x) => x.id === jobId)?.produced.push(mediaId);
        });
      } catch (err) {
        lastError = err instanceof ProviderError ? err : new ProviderError(String(err), "provider_error");
        console.error(`[job ${jobId}] image ${i + 1}/${job.count} :`, lastError.message);
      }
    }
  } catch (err) {
    lastError = err instanceof ProviderError ? err : new ProviderError(String(err), "provider_error");
  }

  await mutate((db) => {
    const j = db.jobs.find((x) => x.id === jobId);
    if (!j) return;
    const missing = j.count - j.produced.length;
    db.profile.credits += missing;
    j.status = j.produced.length > 0 ? "complete" : "failed";
    j.error = lastError ? `${lastError.code}: ${lastError.message}` : null;
    j.finishedAt = new Date().toISOString();
  });
}

let recovered = false;
async function recoverStaleJobs(): Promise<void> {
  if (recovered) return;
  recovered = true;
  await mutate((db) => {
    for (const j of db.jobs) {
      if (j.status === "queued" || j.status === "running") {
        db.profile.credits += j.count - j.produced.length;
        j.status = j.produced.length > 0 ? "complete" : "failed";
        j.error = "provider_error: interrompu par un redémarrage du serveur";
        j.finishedAt = new Date().toISOString();
      }
    }
  });
}
