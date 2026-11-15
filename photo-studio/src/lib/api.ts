import { NextResponse } from "next/server";
import { requireUser, type SessionUser } from "./auth";
import { AppError } from "./errors";
import { ProviderError } from "./providers";
import { fileUrl } from "./storage";
import type { GenerationInfo, TwinProfile } from "./types";

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

export function withUser<A extends unknown[]>(fn: (user: SessionUser, ...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(await requireUser(), ...args);
    } catch (err) {
      return handleError(err);
    }
  };
}

export function profileView(p: TwinProfile, user: SessionUser) {
  return {
    user: { name: user.name, email: user.email, image: user.image },
    photos: p.photos.map((ph) => ({ id: ph.id, kind: ph.kind, angle: ph.angle, url: fileUrl(ph.file) })),
    primaryColor: p.primaryColor,
    secondaryColor: p.secondaryColor,
    hair: p.hair,
    makeup: p.makeup,
    credits: p.credits,
    consented: p.consentedAt !== null,
    provider: (process.env.IMAGE_PROVIDER ?? "mock").toLowerCase(),
  };
}

export function mediaView(m: { id: string; file: string; createdAt: Date; favorite: boolean; generation: GenerationInfo }) {
  return { id: m.id, url: fileUrl(m.file), createdAt: m.createdAt.toISOString(), favorite: m.favorite, generation: m.generation };
}

export function jobView(j: { id: string; status: string; count: number; produced: number; error: string | null; generation: GenerationInfo }) {
  return { id: j.id, status: j.status, count: j.count, produced: j.produced, error: j.error, collectionName: j.generation.collectionName };
}
