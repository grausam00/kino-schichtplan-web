import { supabase } from "@/lib/supabase/client";

export type ShiftRowDb = {
  id: number;
  date: string;
  time_slot: string;
  min_persons: number | null;
  max_persons: number | null;
  assignments?: Array<{
    id: number;
    status: string;
    user_id: string;
    users: { name: string } | null;
  }> | null;
};

export async function fetchShiftsInRange(startIso: string, endIso: string) {
  const { data, error } = await supabase
    .from("shifts")
    .select(`
      id,
      date,
      time_slot,
      min_persons,
      max_persons,
      assignments (
        id,
        status,
        user_id,
        users ( name )
      )
    `)
    .gte("date", startIso)
    .lte("date", endIso)
    .order("date", { ascending: true })
    .order("time_slot", { ascending: true });

  if (error) throw error;
  return (data || []) as ShiftRowDb[];
}

export async function fetchAllShiftDates() {
  const { data, error } = await supabase
    .from("shifts")
    .select("date")
    .order("date", { ascending: true });

  if (error) throw error;
  return (data || []).map((r: any) => r.date as string);
}

export async function fetchShiftCapacity(shiftId: number) {
  const { data, error } = await supabase
    .from("shifts")
    .select(`id, max_persons, assignments(status)`)
    .eq("id", shiftId)
    .single();

  if (error) throw error;
  return data as any;
}

export async function updateShiftMaxPersons(shiftId: number, maxPersons: number) {
  const { data, error } = await supabase
    .from("shifts")
    .update({ max_persons: maxPersons })
    .eq("id", shiftId)
    .select("id, max_persons")
    .single();

  if (error) throw error;
  return data as { id: number; max_persons: number };
}