export type TwinKind = "smiling" | "neutral";
export type AngleKey = "front" | "right45" | "profile" | "fullbody";
export type Energy = "warm" | "polished";
export type AspectRatio = "4:5" | "9:16" | "1:1" | "16:9";
export type IntentKey = "website_profile" | "campaign" | "social_content" | "industry";
export type GenerationMode = "collection" | "reference" | "custom";

export interface TwinPhoto {
  id: string;
  kind: TwinKind;
  angle: AngleKey;
  file: string;
  mimeType: string;
  createdAt: string;
}

export interface StyleOverride {
  mode: "none" | "collection" | "custom";
  value: string | null;
}

export interface TwinProfile {
  photos: TwinPhoto[];
  primaryColor: string | null;
  secondaryColor: string | null;
  hair: StyleOverride;
  makeup: StyleOverride;
  credits: number;
  updatedAt: string;
}

export interface Collection {
  key: string;
  intent: IntentKey;
  industry?: string;
  name: string;
  tagline: string;
  energy: Energy;
  scene: string;
  wardrobe: string;
  lighting: string;
  camera: string;
  mood: string;
}

export interface Industry {
  key: string;
  name: string;
  settings: string[];
  props: string;
}

export interface GenerationInfo {
  mode: GenerationMode;
  intent: IntentKey | null;
  collectionKey: string | null;
  collectionName: string | null;
  twin: TwinKind;
  aspectRatio: AspectRatio;
  prompt: string;
}

export interface MediaItem {
  id: string;
  file: string;
  mimeType: string;
  createdAt: string;
  favorite: boolean;
  jobId: string;
  generation: GenerationInfo;
}

export type JobStatus = "queued" | "running" | "complete" | "failed";

export interface Job {
  id: string;
  status: JobStatus;
  count: number;
  produced: string[];
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  generation: GenerationInfo;
}

export interface Database {
  profile: TwinProfile;
  media: MediaItem[];
  jobs: Job[];
}

export type ApiErrorCode =
  | "invalid_request"
  | "twin_missing"
  | "not_enough_credits"
  | "too_many_pending_jobs"
  | "generation_blocked"
  | "provider_error"
  | "file_too_large"
  | "unsupported_file"
  | "not_found";
