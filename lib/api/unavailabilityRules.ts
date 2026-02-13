import { supabase } from "@/lib/supabase/client";
import type {
  CreateUnavailabilityRuleInput,
  UnavailabilityRuleRow,
} from "@/lib/rules/unavailabilityRules";

const TABLE = "unavailability_rules";

export async function listUnavailabilityRulesByUser(userId: string): Promise<UnavailabilityRuleRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id,user_id,weekday,time_slot,comment,created_at")
    .eq("user_id", userId)
    .order("weekday", { ascending: true })
    // nulls first wäre nice (Ganztägig oben) — Supabase hat dafür je nach Version Optionen,
    // deshalb machen wir Sortierung später in rules/page
    .order("time_slot", { ascending: true });

  if (error) throw error;
  return (data as UnavailabilityRuleRow[]) ?? [];
}

export async function createUnavailabilityRulesBulk(inputs: CreateUnavailabilityRuleInput[]) {
  const { error } = await supabase.from(TABLE).insert(inputs);
  if (error) throw error;
}

export async function deleteUnavailabilityRuleById(id: number) {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}
