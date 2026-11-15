import { promises as fs } from "node:fs";
import type { NextRequest } from "next/server";
import { resolveFile } from "@/lib/store";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", svg: "image/svg+xml" };

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const rel = (await ctx.params).path.join("/");
  const abs = resolveFile(rel);
  const type = TYPES[rel.split(".").pop() ?? ""];
  if (!abs || !type) return new Response("Not found", { status: 404 });
  try {
    const data = await fs.readFile(abs);
    const headers: Record<string, string> = {
      "Content-Type": type,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    };
    if (req.nextUrl.searchParams.has("download")) headers["Content-Disposition"] = `attachment; filename="photo-${rel.split("/").pop()}"`;
    return new Response(new Uint8Array(data), { headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
