import { mediaView, ok, withUser } from "@/lib/api";
import { listMedia } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const GET = withUser(async (user) => ok({ media: (await listMedia(user.id)).map(mediaView) }));
