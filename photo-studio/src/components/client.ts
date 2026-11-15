import type { AngleKey, AspectRatio, Energy, GenerationInfo, IntentKey, StyleOverride, TwinKind } from "@/lib/types";

export interface Catalog {
  angles: { key: AngleKey; label: string; hint: string; required: boolean }[];
  aspectRatios: { key: AspectRatio; label: string; usage: string }[];
  intents: { key: IntentKey; label: string; shortLabel: string; description: string }[];
  industries: { key: string; name: string }[];
  collections: { key: string; intent: IntentKey; industry?: string; name: string; tagline: string; energy: Energy }[];
  maxPhotosPerJob: number;
}

export interface ProfilePhoto { id: string; kind: TwinKind; angle: AngleKey; url: string }

export interface Profile {
  photos: ProfilePhoto[];
  primaryColor: string | null;
  secondaryColor: string | null;
  hair: StyleOverride;
  makeup: StyleOverride;
  credits: number;
  provider: string;
}

export interface Media { id: string; url: string; createdAt: string; favorite: boolean; generation: GenerationInfo }

export interface JobState {
  id: string;
  status: "queued" | "running" | "complete" | "failed";
  count: number;
  error: string | null;
  media?: Media[];
  credits?: number;
}

export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: json !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError("network", "Connexion impossible. Vérifiez votre réseau et réessayez.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "unknown", data.message ?? "Une erreur est survenue. Réessayez.");
  return data as T;
}

export function hasTwin(p: Profile | null, kind: TwinKind): boolean {
  return !!p?.photos.some((x) => x.kind === kind && x.angle === "front");
}

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(" ");
}
