import { ASPECT_RATIOS } from "./catalog";
import type { AspectRatio, Collection, StyleOverride, TwinKind, TwinProfile } from "./types";

const EXPRESSION: Record<TwinKind, string> = {
  smiling: "a natural, warm, genuine smile matching the reference photos",
  neutral: "a relaxed, confident neutral expression with no smile, calm and composed",
};

function styleLine(label: string, o: StyleOverride, collectionDefault: string): string {
  if (o.mode === "custom" && o.value) return `${label}: ${o.value}.`;
  if (o.mode === "collection") return `${label}: styled to fit the scene (${collectionDefault}).`;
  return `${label}: keep exactly as in the reference photos.`;
}

function brandLine(p: TwinProfile): string {
  const colors = [p.primaryColor, p.secondaryColor].filter(Boolean);
  if (colors.length === 0) return "";
  return `Brand palette: subtly weave ${colors.join(" and ")} into the outfit and environment accents, tasteful and never overwhelming.`;
}

function ratioLine(r: AspectRatio): string {
  return `Format: ${ASPECT_RATIOS.find((a) => a.key === r)?.promptHint ?? r}.`;
}

const IDENTITY = [
  "IDENTITY LOCK: the person must be the exact same individual as in the reference photos.",
  "Preserve face shape, eye shape and color, nose, lips, skin tone, freckles or marks, hairline, age and body proportions.",
  "Do not beautify, slim, de-age or alter ethnicity.",
].join(" ");

const REALISM = [
  "Style: photorealistic professional photograph, natural skin texture with visible pores, realistic hands with five fingers, accurate anatomy, true-to-life colors, shallow depth of field where appropriate.",
  "Strictly no text, no letters, no logos, no watermarks, no brand names, no graphic overlays, no borders.",
].join(" ");

export function buildCollectionPrompt(opts: {
  collection: Collection;
  twin: TwinKind;
  profile: TwinProfile;
  aspectRatio: AspectRatio;
}): string {
  const { collection: c, twin, profile, aspectRatio } = opts;
  return [
    IDENTITY,
    `Subject: the woman from the reference photos, ${EXPRESSION[twin]}.`,
    `Scene: ${c.scene}.`,
    `Wardrobe: ${c.wardrobe}.`,
    styleLine("Hair", profile.hair, "natural, polished"),
    styleLine("Makeup", profile.makeup, "natural, camera-ready"),
    brandLine(profile),
    `Lighting: ${c.lighting}.`,
    `Camera: ${c.camera}.`,
    `Mood: ${c.mood}.`,
    ratioLine(aspectRatio),
    REALISM,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildCustomPrompt(opts: {
  userPrompt: string;
  twin: TwinKind;
  profile: TwinProfile;
  aspectRatio: AspectRatio;
}): string {
  const { userPrompt, twin, profile, aspectRatio } = opts;
  return [
    IDENTITY,
    `Subject: the woman from the reference photos, ${EXPRESSION[twin]}.`,
    `Brief: ${userPrompt.trim()}`,
    styleLine("Hair", profile.hair, "fitting the brief"),
    styleLine("Makeup", profile.makeup, "fitting the brief"),
    brandLine(profile),
    ratioLine(aspectRatio),
    REALISM,
  ]
    .filter(Boolean)
    .join("\n");
}

export const REFERENCE_ANALYSIS_INSTRUCTIONS = `You are a senior photography director.
Analyze the attached photo and write a reusable photography brief that would recreate its look with a DIFFERENT person.
Never describe the face, identity, ethnicity, age or body of the person in the photo.
Describe only: setting, background, wardrobe style, pose, framing, camera angle, lens feel, lighting direction and quality, color grading, mood.
Return strict JSON: {"brief": string (English, 60-120 words, no line breaks), "energy": "warm" | "polished", "suggestedRatio": "4:5" | "9:16" | "1:1" | "16:9"}.
"warm" if the subject smiles or the mood is casual; "polished" if it is serious, corporate or editorial.`;
