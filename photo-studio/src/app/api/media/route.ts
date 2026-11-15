import { mediaView, ok } from "@/lib/api";
import { read } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const media = await read((db) => db.media);
  return ok({ media: media.map(mediaView) });
}
