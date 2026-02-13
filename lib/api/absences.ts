// lib/api/absences.ts
import { supabase } from "@/lib/supabase/client";
import type { AbsenceRow, CreateAbsenceInput } from "@/lib/rules/absences";

export async function listAbsencesByUser(userId: string): Promise<AbsenceRow[]> {
  const { data, error } = await supabase
    .from("absences")
    .select("id,user_id,type,start_date,end_date,comment")
    .eq("user_id", userId)
    .order("start_date", { ascending: false });

  if (error) throw error;
  return (data as AbsenceRow[]) ?? [];
}

export async function createAbsence(input: CreateAbsenceInput) {
  const { error } = await supabase.from("absences").insert(input);
  if (error) throw error;
}

export async function deleteAbsenceById(id: number) {
  const { error } = await supabase.from("absences").delete().eq("id", id);
  if (error) throw error;
}
