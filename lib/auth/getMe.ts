import { supabase } from "@/lib/supabase/client";

export async function getMe() {
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData?.user) return { user: null, profile: null };

  const userId = authData.user.id;

  const { data: profile, error: profErr } = await supabase
    .from("users")
    .select("id,email,role,name,status")
    .eq("id", userId)
    .single();

  if (profErr) return { user: authData.user, profile: null };

  return { user: authData.user, profile };
}
