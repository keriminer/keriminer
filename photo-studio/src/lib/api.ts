import { NextResponse } from "next/server";
import { AppError } from "./generation";
import { ProviderError } from "./providers";
import { fileUrl } from "./store";
import type { Job, MediaItem, TwinProfile } from "./types";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function handleError(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json({ error: err.code, message: err.message, ...err.details }, { status: err.status });
  }
  if (err instanceof ProviderError) {
    return NextResponse.json({ error: err.code, message: err.message }, { status: err.code === "generation_blocked" ? 422 : 502 });
  }
  console.error(err);
  return NextResponse.json({ error: "provider_error", message: "Erreur interne. Réessayez." }, { status: 500 });
}

export function profileView(p: TwinProfile) {
  return {
    ...p,
    photos: p.photos.map((ph) => ({ id: ph.id, kind: ph.kind, angle: ph.angle, url: fileUrl(ph.file) })),
    provider: (process.env.IMAGE_PROVIDER ?? "mock").toLowerCase(),
  };
}

export function mediaView(m: MediaItem) {
  return { id: m.id, url: fileUrl(m.file), createdAt: m.createdAt, favorite: m.favorite, generation: m.generation };
}

export function jobView(j: Job) {
  return { id: j.id, status: j.status, count: j.count, produced: j.produced, error: j.error, collectionName: j.generation.collectionName };
}
