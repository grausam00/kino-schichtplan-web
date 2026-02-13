// lib/api/staffing.ts
import { supabase } from "@/lib/supabase/client";
import type { StaffingProfile, SchoolHoliday } from "@/lib/types/staffing";
import {
  isoUTC,
  isHoliday,
  profileValue,
  shouldOverwriteMax,
  getDefaultProfile,
} from "@/lib/rules/staffing";

export async function loadStaffingData() {
  const [
    { data: normalData, error: nErr },
    { data: holidayData, error: hErr },
    { data: holidaysList, error: holErr },
  ] = await Promise.all([
    supabase
      .from("settings")
      .select("value")
      .eq("key", "pflichtbesetzung_normal")
      .single(),
    supabase
      .from("settings")
      .select("value")
      .eq("key", "pflichtbesetzung_ferien")
      .single(),
    supabase
      .from("school_holidays_bw")
      .select("*")
      .order("start_date", { ascending: true }),
  ]);

  // PGRST116 = "No rows found" bei .single()
  if (nErr && nErr.code !== "PGRST116")
    throw new Error("pflichtbesetzung_normal: " + nErr.message);
  if (hErr && hErr.code !== "PGRST116")
    throw new Error("pflichtbesetzung_ferien: " + hErr.message);
  if (holErr) throw new Error("school_holidays_bw: " + holErr.message);

  return {
    normalProfile: (normalData?.value ?? getDefaultProfile()) as StaffingProfile,
    holidayProfile:
      (holidayData?.value ?? getDefaultProfile()) as StaffingProfile,
    holidays: (holidaysList ?? []) as SchoolHoliday[],
  };
}

export async function saveStaffingProfile(params: {
  key: "pflichtbesetzung_normal" | "pflichtbesetzung_ferien";
  value: StaffingProfile;
  updatedBy: string;
}) {
  const { error } = await supabase.from("settings").upsert(
    {
      key: params.key,
      value: params.value,
      updated_by: params.updatedBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) throw new Error(error.message);
}

export async function syncFutureShiftsFromProfiles(params: {
  normalProfile: StaffingProfile;
  holidayProfile: StaffingProfile;
  holidays: Pick<SchoolHoliday, "start_date" | "end_date">[];
  fromDate?: string; // ISO, default heute
}) {
  const fromIso = params.fromDate ?? isoUTC(new Date());

  const { data: futureShifts, error: futureErr } = await supabase
    .from("shifts")
    .select("id, date, time_slot, min_persons, max_persons")
    .gte("date", fromIso);

  if (futureErr) throw new Error(futureErr.message);

  const updates = (futureShifts ?? []).map((s: any) => {
    const useHoliday = isHoliday(s.date, params.holidays);
    const prof = useHoliday ? params.holidayProfile : params.normalProfile;

    const val = profileValue(prof, s.date, s.time_slot);
    const newMin = val;

    // Variante 2: max nur überschreiben, wenn es sehr wahrscheinlich Default ist
    const overwriteMax = shouldOverwriteMax(
      s.max_persons ?? null,
      s.min_persons ?? null
    );
    const newMax = overwriteMax ? val : (s.max_persons ?? val);

    return { id: s.id, min_persons: newMin, max_persons: newMax };
  });

  if (updates.length === 0) return { updated: 0 };

  // ✅ WICHTIG: KEIN upsert() hier, sondern update() -> verhindert Inserts mit date=null
  let updatedCount = 0;

  for (const u of updates) {
    if (u.id == null) continue;

    const { error } = await supabase
      .from("shifts")
      .update({
        min_persons: u.min_persons,
        max_persons: u.max_persons,
      })
      .eq("id", u.id);

    if (error) throw new Error(error.message);
    updatedCount++;
  }

  return { updated: updatedCount };
}

export async function addHoliday(
  name: string,
  start_date: string,
  end_date: string
) {
  const { error } = await supabase
    .from("school_holidays_bw")
    .insert([{ name, start_date, end_date }]);

  if (error) throw new Error(error.message);
}

export async function deleteHoliday(id: number) {
  const { error } = await supabase
    .from("school_holidays_bw")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}
