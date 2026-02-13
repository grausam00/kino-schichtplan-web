// lib/api/adminRequests.ts
import { supabase } from "@/lib/supabase/client";

export type RequestRow = {
  id: number;
  user_id: string;
  shift_id: number;
  status: "freiwillig" | "fix" | "abgesagt" | "frei";
  created_at: string | null;

  // optional joined fields, je nach select:
  user_name?: string | null;
  shift_date?: string | null;      // "YYYY-MM-DD"
  shift_time_slot?: string | null; // "14:00" etc.
  shift_max_persons?: number | null;
};

export async function fetchOpenRequests(): Promise<RequestRow[]> {
  // status "freiwillig" = Anfrage
  const { data, error } = await supabase
    .from("assignments")
    .select(`
      id,
      user_id,
      shift_id,
      status,
      created_at,
      users:users ( name ),
      shifts:shifts ( date, time_slot, max_persons )
    `)
    .eq("status", "freiwillig")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  // Flatten (damit UI nicht mit nested objects kämpfen muss)
  return (data ?? []).map((r: any) => ({
    id: r.id,
    user_id: r.user_id,
    shift_id: r.shift_id,
    status: r.status,
    created_at: r.created_at ?? null,
    user_name: r.users?.name ?? null,
    shift_date: r.shifts?.date ?? null,
    shift_time_slot: r.shifts?.time_slot ?? null,
    shift_max_persons: r.shifts?.max_persons ?? null,
  }));
}

/**
 * Approve setzt status=fix, aber nur wenn Kapazität frei ist.
 * Zählt "fix" als belegt; optional auch "freiwillig".
 */
export async function approveRequest(assignmentId: number, shiftId: number) {
  // 1) Shift laden (max_persons)
  const { data: shift, error: sErr } = await supabase
    .from("shifts")
    .select("id, max_persons")
    .eq("id", shiftId)
    .single();

  if (sErr) throw new Error("Shift laden fehlgeschlagen: " + sErr.message);

  const maxP = shift?.max_persons ?? 0;

  // 2) Belegung zählen (fix) — optional: freiwillig auch zählen
  const { data: occ, error: oErr } = await supabase
    .from("assignments")
    .select("id, status")
    .eq("shift_id", shiftId)
    .in("status", ["fix" , "freiwillig"]); // wenn Anfragen mit zählen sollen -> "freiwillig" dazu

  if (oErr) throw new Error("Belegung prüfen fehlgeschlagen: " + oErr.message);

  const occupied = (occ ?? []).length;
  if (occupied >= maxP) {
    throw new Error("Schicht ist voll. Approve nicht möglich.");
  }

  // 3) Approve
  const { error: upErr } = await supabase
    .from("assignments")
    .update({ status: "fix" })
    .eq("id", assignmentId);

  if (upErr) throw new Error("Approve fehlgeschlagen: " + upErr.message);
}

export async function denyRequest(assignmentId: number) {
  // Du kannst entweder löschen oder status="abgesagt" setzen.
  // Status ist besser fürs Audit.
  const { error } = await supabase
    .from("assignments")
    .update({ status: "abgesagt" })
    .eq("id", assignmentId);

  if (error) throw new Error("Ablehnen fehlgeschlagen: " + error.message);
}
