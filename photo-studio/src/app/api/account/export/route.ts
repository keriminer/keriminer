import { withUser } from "@/lib/api";
import { exportUserData } from "@/lib/repo";

export const GET = withUser(async (user) => {
  const data = await exportUserData(user.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="twinshoot-export-${new Date().toISOString().slice(0, 10)}.json"` },
  });
});
