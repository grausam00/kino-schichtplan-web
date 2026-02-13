import { supabase } from "@/lib/supabase/client";

export async function createPendingAssignment(shiftId: number, userId: string) {
  const { error } = await supabase.from("assignments").insert({
    shift_id: shiftId,
    user_id: userId,
    status: "freiwillig",
  });
  if (error) throw error;
}

export async function cancelMyAssignment(shiftId: number, userId: string) {
  const { error } = await supabase
    .from("assignments")
    .update({ status: "abgesagt" })
    .eq("shift_id", shiftId)
    .eq("user_id", userId)
    .in("status", ["fix", "freiwillig"]);

  if (error) throw error;
}
