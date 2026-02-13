// lib/api/auth.ts
import { supabase } from "@/lib/supabase/client";
import { getMe } from "@/lib/auth/getMe";
import { redirectAfterLogin } from "@/lib/rules/authRedirect";

export async function loginWithPassword(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  const { user, profile } = await getMe();
  if (!user) throw new Error("Login fehlgeschlagen: Keine Session nach signIn.");

  return { user, profile, redirectTo: redirectAfterLogin(profile ?? null) };
}

export async function loginWithOAuth(provider: "google" | "github") {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}/login` },
  });
  if (error) throw error;

  return { url: data.url };
}

export async function logoutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUserAndProfile() {
  return getMe();
}
