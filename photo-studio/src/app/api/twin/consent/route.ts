import { ok, profileView, withUser } from "@/lib/api";
import { getProfile, setConsent } from "@/lib/repo";

export const POST = withUser(async (user) => {
  await setConsent(user.id);
  return ok(profileView(await getProfile(user.id), user));
});
