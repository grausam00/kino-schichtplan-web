// lib/api/wishes.ts
import { supabase } from "@/lib/supabase/client";
import type { CreateWishInput, WishRow } from "@/lib/rules/wishes";

export async function listWishesByUser(userId: string): Promise<WishRow[]> {
  const { data, error } = await supabase
    .from("shift_wishes")
    .select("id,user_id,weekday,time_slot,created_at")
    .eq("user_id", userId)
    .order("weekday", { ascending: true })
    .order("time_slot", { ascending: true });

  if (error) throw error;
  return (data as WishRow[]) ?? [];
}

export async function createWish(input: CreateWishInput) {
  const { error } = await supabase.from("shift_wishes").insert(input);
  if (error) throw error;
}

export async function deleteWishById(id: number) {
  const { error } = await supabase.from("shift_wishes").delete().eq("id", id);
  if (error) throw error;
}
