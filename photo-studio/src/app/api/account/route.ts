import { ok, withUser } from "@/lib/api";
import { deleteAccount } from "@/lib/repo";

export const DELETE = withUser(async (user) => {
  await deleteAccount(user.id);
  const res = ok({ deleted: true });
  for (const name of ["better-auth.session_token", "__Secure-better-auth.session_token", "better-auth.session_data", "__Secure-better-auth.session_data"]) {
    res.cookies.set(name, "", { maxAge: 0, path: "/" });
  }
  return res;
});
