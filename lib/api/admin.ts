// lib/api/admin.ts
import { getMe } from "@/lib/auth/getMe";
import { decideAdminAccess } from "@/lib/rules/adminAccess";

export async function checkAdminAccess() {
  const { user, profile } = await getMe();
  return decideAdminAccess(user ?? null, profile ?? null);
}
