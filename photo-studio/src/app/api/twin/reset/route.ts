import type { NextRequest } from "next/server";
import { ok, profileView, withUser } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { getProfile, resetTwin } from "@/lib/repo";

export const POST = withUser(async (user, req: NextRequest) => {
  const { kind } = (await req.json().catch(() => ({}))) as { kind?: string };
  if (kind !== "smiling" && kind !== "neutral") throw new AppError("invalid_request", "Type de jumelle invalide.");
  await resetTwin(user.id, kind);
  return ok(profileView(await getProfile(user.id), user));
});
