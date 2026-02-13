// lib/rules/authRedirect.ts

type ProfileLike = {
  role?: string | null; // "admin" | "mitarbeiter" | ...
} | null;

export function redirectAfterLogin(profile: ProfileLike): "/admin" | "/plan" {
  return profile?.role === "admin" ? "/admin" : "/plan";
}
