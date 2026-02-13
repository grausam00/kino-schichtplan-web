// lib/api/solverConfig.ts
import { supabase } from "@/lib/supabase/client";
import {
  normalizeSolverConfig,
  collectUserKeys,
  mapConfigToRows,
  type SolverConfigJSON,
} from "@/lib/rules/solverConfig";

type DBUser = { id: string; name: string | null };

export async function loadSolverConfigByName(name: string): Promise<SolverConfigJSON> {
  const { data, error } = await supabase
    .from("solver_configs")
    .select("config")
    .eq("name", name)
    .single();

  if (error) throw error;

  const raw = (data as any)?.config;
  return normalizeSolverConfig(raw);
}

async function buildNameToIdMap(userIds: string[], userNames: string[]) {
  const nameToId = new Map<string, string>();

  // 1) IDs: validieren, dass sie existieren (FK sonst error)
  if (userIds.length > 0) {
    const { data, error } = await supabase
      .from("users")
      .select("id,name")
      .in("id", userIds);

    if (error) throw error;

    const found = (data ?? []) as DBUser[];
    const foundIds = new Set(found.map((u) => u.id));
    const missing = userIds.filter((id) => !foundIds.has(id));
    if (missing.length) {
      throw new Error(`SolverConfig apply: unbekannte user_id(s): ${missing.join(", ")}`);
    }

    // optional: nameToId auch hier befüllen
    for (const u of found) if (u.name) nameToId.set(u.name, u.id);
  }

  // 2) Names: auflösen -> IDs
  if (userNames.length > 0) {
    const { data, error } = await supabase
      .from("users")
      .select("id,name")
      .in("name", userNames);

    if (error) throw error;

    const found = (data ?? []) as DBUser[];
    const foundNames = new Set(found.map((u) => u.name ?? ""));
    const missingNames = userNames.filter((n) => !foundNames.has(n));
    if (missingNames.length) {
      throw new Error(`SolverConfig apply: unbekannte user_name(s): ${missingNames.join(", ")}`);
    }

    for (const u of found) if (u.name) nameToId.set(u.name, u.id);
  }

  return nameToId;
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

export async function applySolverConfigReplaceByOwner(configName: string) {
  // 1) laden + normalisieren
  const cfg = await loadSolverConfigByName(configName);

  // 2) alle betroffenen user keys sammeln
  const { userIds, userNames } = collectUserKeys(cfg);

  // 3) map name->id und validiere ids/names
  const nameToId = await buildNameToIdMap(userIds, userNames);

  // 4) rows bauen (dabei werden unknown users hart abgelehnt)
  const { absencesRows, wishesRows, unavailRows } = mapConfigToRows(cfg, nameToId);

  // 5) set der owners (alle user_ids die wir anfassen)
  const owners = uniq([
    ...absencesRows.map((r) => r.user_id),
    ...wishesRows.map((r) => r.user_id),
    ...unavailRows.map((r) => r.user_id),
  ]);

  // falls config leer ist, machen wir nichts (oder du willst "alles löschen"?)
  if (owners.length === 0) {
    return {
      ok: true,
      owners: 0,
      absences: 0,
      wishes: 0,
      unavailability: 0,
      note: "Config enthält keine user-bezogenen Regeln – nichts angewendet.",
    };
  }

  // 6) Replace-by-owner: delete existing rows for these owners
  // deletes sind ok auch wenn 0 rows existieren
  {
    const { error } = await supabase.from("absences").delete().in("user_id", owners);
    if (error) throw error;
  }
  {
    const { error } = await supabase.from("shift_wishes").delete().in("user_id", owners);
    if (error) throw error;
  }
  {
    const { error } = await supabase.from("unavailability_rules").delete().in("user_id", owners);
    if (error) throw error;
  }

  // 7) insert new rows (nur wenn nicht leer)
  if (absencesRows.length > 0) {
    const { error } = await supabase.from("absences").insert(absencesRows);
    if (error) throw error;
  }
  if (wishesRows.length > 0) {
    const { error } = await supabase.from("shift_wishes").insert(wishesRows);
    if (error) throw error;
  }
  if (unavailRows.length > 0) {
    const { error } = await supabase.from("unavailability_rules").insert(unavailRows);
    if (error) throw error;
  }

  return {
    ok: true,
    owners: owners.length,
    absences: absencesRows.length,
    wishes: wishesRows.length,
    unavailability: unavailRows.length,
  };
}
