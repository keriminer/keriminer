import type { NextRequest } from "next/server";
import { ok, profileView, withUser } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { getProfile, updateSettings } from "@/lib/repo";
import type { StyleOverride } from "@/lib/types";

export const dynamic = "force-dynamic";

export const GET = withUser(async (user) => ok(profileView(await getProfile(user.id), user)));

function parseColor(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string" || v.length > 40 || /[<>{}]/.test(v)) throw new AppError("invalid_request", "Couleur invalide.");
  return v.trim();
}

function parseOverride(v: unknown, label: string): StyleOverride {
  const o = (v ?? {}) as Record<string, unknown>;
  if (o.mode === "none" || o.mode === "collection") return { mode: o.mode, value: null };
  if (o.mode === "custom") {
    const value = typeof o.value === "string" ? o.value.trim() : "";
    if (value.length < 3 || value.length > 120) throw new AppError("invalid_request", `${label} : décrivez en 3 à 120 caractères.`);
    return { mode: "custom", value };
  }
  throw new AppError("invalid_request", `${label} : option invalide.`);
}

export const PATCH = withUser(async (user, req: NextRequest) => {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  await updateSettings(user.id, {
    primaryColor: parseColor(body.primaryColor),
    secondaryColor: parseColor(body.secondaryColor),
    hair: parseOverride(body.hair, "Coiffure"),
    makeup: parseOverride(body.makeup, "Maquillage"),
  });
  return ok(profileView(await getProfile(user.id), user));
});
