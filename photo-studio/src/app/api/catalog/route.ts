import { ANGLES, ASPECT_RATIOS, COLLECTIONS, INDUSTRIES, INTENTS, MAX_PHOTOS_PER_JOB } from "@/lib/catalog";
import { ok } from "@/lib/api";

export function GET() {
  return ok({
    angles: ANGLES,
    aspectRatios: ASPECT_RATIOS,
    intents: INTENTS,
    industries: INDUSTRIES.map(({ key, name }) => ({ key, name })),
    collections: COLLECTIONS.map(({ key, intent, industry, name, tagline, energy }) => ({ key, intent, industry, name, tagline, energy })),
    maxPhotosPerJob: MAX_PHOTOS_PER_JOB,
  });
}
