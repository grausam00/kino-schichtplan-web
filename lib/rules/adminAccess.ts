// lib/rules/adminAccess.ts
import type { User } from "@supabase/supabase-js";

type ProfileLike = {
  role?: string | null;
} | null;

export type AdminAccessResult =
  | { allowed: true }
  | { allowed: false; redirectTo: "/login" | "/plan" };

export function decideAdminAccess(user: User | null, profile: ProfileLike): AdminAccessResult {
  if (!user) return { allowed: false, redirectTo: "/login" };
  if (profile?.role !== "admin") return { allowed: false, redirectTo: "/plan" };
  return { allowed: true };
}
