import type { AspectRatio, Energy } from "../types";
import { geminiProvider } from "./gemini";
import { mockProvider } from "./mock";

export interface ReferenceImage {
  mimeType: string;
  base64: string;
}

export interface GeneratedImage {
  mimeType: string;
  data: Buffer;
}

export interface ReferenceAnalysis {
  brief: string;
  energy: Energy;
  suggestedRatio: AspectRatio;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly code: "generation_blocked" | "provider_error",
  ) {
    super(message);
  }
}

export interface ImageProvider {
  name: string;
  generate(input: { prompt: string; references: ReferenceImage[]; aspectRatio: AspectRatio }): Promise<GeneratedImage>;
  analyzeReference(image: ReferenceImage): Promise<ReferenceAnalysis>;
}

export function getProvider(): ImageProvider {
  const name = (process.env.IMAGE_PROVIDER ?? "mock").toLowerCase();
  if (name === "gemini") {
    if (!process.env.GEMINI_API_KEY) throw new ProviderError("GEMINI_API_KEY manquante dans .env.local", "provider_error");
    return geminiProvider;
  }
  return mockProvider;
}
