import { supabase } from "@/lib/supabase/client";
import type { StaffingProfile } from "@/lib/types/staffing";

export async function fetchStaffingProfiles() {
  const { data: normalData, error: e1 } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "pflichtbesetzung_normal")
    .single();
  if (e1) throw e1;

  const { data: holidayData, error: e2 } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "pflichtbesetzung_ferien")
    .single();
  if (e2) throw e2;

  return {
    normal: (normalData?.value || {}) as StaffingProfile,
    holiday: (holidayData?.value || {}) as StaffingProfile,
  };
}
