import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { STARTING_CREDITS } from "./auth";
import { AppError } from "./errors";
import { deleteFile, deleteUserFiles } from "./storage";
import type { AngleKey, StyleOverride, TwinKind, TwinProfile } from "./types";

const { twinProfile, twinPhoto, media, job, user } = schema;

export async function getProfile(userId: string): Promise<TwinProfile> {
  let row = await db.query.twinProfile.findFirst({ where: eq(twinProfile.userId, userId) });
  if (!row) {
    await db.insert(twinProfile).values({ userId, credits: STARTING_CREDITS }).onConflictDoNothing();
    row = (await db.query.twinProfile.findFirst({ where: eq(twinProfile.userId, userId) }))!;
  }
  const photos = await db
    .select({ id: twinPhoto.id, kind: twinPhoto.kind, angle: twinPhoto.angle, file: twinPhoto.file, mimeType: twinPhoto.mimeType })
    .from(twinPhoto)
    .where(eq(twinPhoto.userId, userId));
  return {
    photos,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    hair: row.hair,
    makeup: row.makeup,
    credits: row.credits,
    consentedAt: row.consentedAt,
  };
}

export async function updateSettings(
  userId: string,
  s: { primaryColor: string | null; secondaryColor: string | null; hair: StyleOverride; makeup: StyleOverride },
): Promise<void> {
  await getProfile(userId);
  await db.update(twinProfile).set(s).where(eq(twinProfile.userId, userId));
}

export async function setConsent(userId: string): Promise<void> {
  await getProfile(userId);
  await db.update(twinProfile).set({ consentedAt: new Date() }).where(eq(twinProfile.userId, userId));
}

export async function upsertPhoto(userId: string, p: { kind: TwinKind; angle: AngleKey; file: string; mimeType: string }): Promise<void> {
  const old = await db.query.twinPhoto.findFirst({
    where: and(eq(twinPhoto.userId, userId), eq(twinPhoto.kind, p.kind), eq(twinPhoto.angle, p.angle)),
  });
  await db.transaction(async (tx) => {
    if (old) await tx.delete(twinPhoto).where(eq(twinPhoto.id, old.id));
    await tx.insert(twinPhoto).values({ id: randomUUID(), userId, ...p });
  });
  if (old) await deleteFile(old.file);
}

export async function deletePhoto(userId: string, id: string): Promise<void> {
  const [row] = await db.delete(twinPhoto).where(and(eq(twinPhoto.id, id), eq(twinPhoto.userId, userId))).returning({ file: twinPhoto.file });
  if (!row) throw new AppError("not_found", "Photo introuvable.", 404);
  await deleteFile(row.file);
}

export async function resetTwin(userId: string, kind: TwinKind): Promise<void> {
  const rows = await db.delete(twinPhoto).where(and(eq(twinPhoto.userId, userId), eq(twinPhoto.kind, kind))).returning({ file: twinPhoto.file });
  await Promise.all(rows.map((r) => deleteFile(r.file)));
}

export async function listMedia(userId: string, limit = 500) {
  return db.select().from(media).where(eq(media.userId, userId)).orderBy(desc(media.createdAt)).limit(limit);
}

export async function setFavorite(userId: string, id: string, favorite: boolean) {
  const [row] = await db.update(media).set({ favorite }).where(and(eq(media.id, id), eq(media.userId, userId))).returning();
  if (!row) throw new AppError("not_found", "Photo introuvable.", 404);
  return row;
}

export async function deleteMedia(userId: string, id: string): Promise<void> {
  const [row] = await db.delete(media).where(and(eq(media.id, id), eq(media.userId, userId))).returning({ file: media.file });
  if (!row) throw new AppError("not_found", "Photo introuvable.", 404);
  await deleteFile(row.file);
}

export async function getJobWithMedia(userId: string, id: string) {
  const row = await db.query.job.findFirst({ where: and(eq(job.id, id), eq(job.userId, userId)) });
  if (!row) return null;
  const items = await db.select().from(media).where(and(eq(media.jobId, id), eq(media.userId, userId))).orderBy(desc(media.createdAt));
  const profile = await db.query.twinProfile.findFirst({ where: eq(twinProfile.userId, userId), columns: { credits: true } });
  return { job: row, media: items, credits: profile?.credits ?? 0 };
}

export async function exportUserData(userId: string) {
  const [u] = await db.select({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt }).from(user).where(eq(user.id, userId));
  const profile = await getProfile(userId);
  const jobs = await db.select().from(job).where(eq(job.userId, userId)).orderBy(desc(job.createdAt));
  const items = await listMedia(userId, 10_000);
  const ledger = await db.select().from(schema.creditLedger).where(eq(schema.creditLedger.userId, userId)).orderBy(desc(schema.creditLedger.createdAt));
  const orders = await db.select().from(schema.paymentOrder).where(eq(schema.paymentOrder.userId, userId)).orderBy(desc(schema.paymentOrder.createdAt));
  return { user: u, profile, jobs, media: items, creditLedger: ledger, paymentOrders: orders, exportedAt: new Date().toISOString() };
}

export async function deleteAccount(userId: string): Promise<void> {
  const running = await db
    .select({ id: job.id })
    .from(job)
    .where(and(eq(job.userId, userId), inArray(job.status, ["queued", "running"])));
  if (running.length > 0) throw new AppError("too_many_pending_jobs", "Des générations sont en cours. Réessayez dans quelques minutes.", 409);
  await db.delete(user).where(eq(user.id, userId));
  await deleteUserFiles(userId);
}
