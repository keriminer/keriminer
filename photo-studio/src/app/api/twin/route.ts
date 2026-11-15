import type { NextRequest } from "next/server";
import { handleError, ok, profileView } from "@/lib/api";
import { AppError } from "@/lib/generation";
import { mutate, read } from "@/lib/store";
import type { StyleOverride } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return ok(profileView(await read((db) => db.profile)));
}

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

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const update = {
      primaryColor: parseColor(body.primaryColor),
      secondaryColor: parseColor(body.secondaryColor),
      hair: parseOverride(body.hair, "Coiffure"),
      makeup: parseOverride(body.makeup, "Maquillage"),
    };
    const profile = await mutate((db) => {
      Object.assign(db.profile, update);
      return structuredClone(db.profile);
    });
    return ok(profileView(profile));
  } catch (err) {
    return handleError(err);
  }
}
