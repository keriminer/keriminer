import { toNextJsHandler } from "better-auth/next-js";
import { dbReady } from "@/db";
import { auth } from "@/lib/auth";

const handler = toNextJsHandler(async (req: Request) => {
  await dbReady;
  return auth.handler(req);
});

export const { GET, POST } = handler;
