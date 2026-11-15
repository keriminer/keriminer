import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { db, dbReady, schema } from "@/db";
import { AppError } from "./errors";

const google =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } }
    : undefined;

export const STARTING_CREDITS = Number(process.env.STARTING_CREDITS ?? 20);

export const auth = betterAuth({
  appName: "TwinShoot Studio",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
  }),
  emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128, autoSignIn: true },
  socialProviders: google,
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24, cookieCache: { enabled: true, maxAge: 5 * 60 } },
  rateLimit: { enabled: true, window: 60, max: 30, customRules: { "/sign-in/email": { window: 60, max: 5 }, "/sign-up/email": { window: 60, max: 3 } } },
  advanced: { database: { generateId: () => randomUUID() } },
  databaseHooks: {
    user: {
      create: {
        after: async (u) => {
          await db.transaction(async (tx) => {
            await tx.insert(schema.twinProfile).values({ userId: u.id, credits: STARTING_CREDITS }).onConflictDoNothing();
            await tx.insert(schema.creditLedger).values({ id: randomUUID(), userId: u.id, delta: STARTING_CREDITS, reason: "signup_bonus" });
          });
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export async function currentUser(): Promise<SessionUser | null> {
  await dbReady;
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  return { id: s.user.id, name: s.user.name, email: s.user.email, image: s.user.image ?? null };
}

export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) throw new AppError("unauthorized", "Session expirée. Reconnectez-vous.", 401);
  return u;
}
