import { relations } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { GenerationInfo, StyleOverride } from "@/lib/types";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/* ── Better Auth ── */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/* ── Application ── */

export const twinProfile = pgTable("twin_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  primaryColor: text("primary_color"),
  secondaryColor: text("secondary_color"),
  hair: jsonb("hair").$type<StyleOverride>().notNull().default({ mode: "none", value: null }),
  makeup: jsonb("makeup").$type<StyleOverride>().notNull().default({ mode: "none", value: null }),
  credits: integer("credits").notNull().default(0),
  consentedAt: timestamp("consented_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const twinPhoto = pgTable(
  "twin_photo",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["smiling", "neutral"] }).notNull(),
    angle: text("angle", { enum: ["front", "right45", "profile", "fullbody"] }).notNull(),
    file: text("file").notNull(),
    mimeType: text("mime_type").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("twin_photo_slot_uq").on(t.userId, t.kind, t.angle)],
);

export const job = pgTable(
  "job",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["queued", "running", "complete", "failed"] }).notNull(),
    count: integer("count").notNull(),
    produced: integer("produced").notNull().default(0),
    error: text("error"),
    generation: jsonb("generation").$type<GenerationInfo>().notNull(),
    createdAt: createdAt(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("job_user_status_idx").on(t.userId, t.status)],
);

export const media = pgTable(
  "media",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    jobId: text("job_id").references(() => job.id, { onDelete: "set null" }),
    file: text("file").notNull(),
    mimeType: text("mime_type").notNull(),
    favorite: boolean("favorite").notNull().default(false),
    generation: jsonb("generation").$type<GenerationInfo>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("media_user_created_idx").on(t.userId, t.createdAt), index("media_job_idx").on(t.jobId)],
);

export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    reason: text("reason", { enum: ["signup_bonus", "generation", "refund", "purchase", "admin"] }).notNull(),
    jobId: text("job_id"),
    createdAt: createdAt(),
  },
  (t) => [index("credit_ledger_user_idx").on(t.userId)],
);

export const userRelations = relations(user, ({ one, many }) => ({
  profile: one(twinProfile, { fields: [user.id], references: [twinProfile.userId] }),
  photos: many(twinPhoto),
  media: many(media),
}));
