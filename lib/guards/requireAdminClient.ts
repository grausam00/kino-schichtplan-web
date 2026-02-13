// lib/guards/requireAdminClient.ts
import { getMe } from "@/lib/auth/getMe";

export async function requireAdminOrRedirect(router: { replace: (path: string) => void }) {
  const { user, profile } = await getMe();
  if (!user) {
    router.replace("/login");
    return { ok: false as const };
  }
  if (profile?.role !== "admin") {
    router.replace("/plan");
    return { ok: false as const };
  }
  return { ok: true as const, user, profile };
}
