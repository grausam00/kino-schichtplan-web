// lib/api/solverConfigs.ts
import { supabase } from "@/lib/supabase/client";

export async function upsertDefaultSolverConfig(cfg: unknown) {
  return supabase
    .from("solver_configs")
    .upsert({ name: "default", config: cfg }, { onConflict: "name" });
}
