import { supabase } from "@/lib/supabase/client";
import type { SchoolHoliday } from "@/lib/types/staffing";

export async function fetchHolidaysBW() {
  const { data, error } = await supabase
    .from("school_holidays_bw")
    .select("*");
  if (error) throw error;
  return (data || []) as SchoolHoliday[];
}
