import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "./auth";

/** À utiliser dans les route handlers (app/api/**\/route.ts) pour protéger les actions admin. */
export async function isAdminRequestAuthenticated(): Promise<boolean> {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminSessionToken(token);
}
