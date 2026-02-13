import { supabase } from "@/lib/supabase/client";
import { WD, slotToSolver } from "@/lib/export/solverMappings";

type DbUser = { id: string; name: string | null; email: string; role: string; status: string };
type DbAbsence = { user_id: string; type: string; start_date: string; end_date: string };
type DbWish = { user_id: string; weekday: number; time_slot: string };
type DbUnavail = { user_id: string; weekday: number; time_slot: string | null };

function inits<T extends object>(o: T | null | undefined, fallback: T): T {
  return (o ?? fallback) as T;
}

export async function buildSolverExportJson() {
  // 1) Template laden
  const tplRes = await fetch("/solver_template.json", { cache: "no-store" });
  if (!tplRes.ok) throw new Error("Konnte /solver_template.json nicht laden. Liegt die Datei in public/?");
  const template = await tplRes.json();

  // 2) DB Daten parallel laden
  const [
    { data: users, error: uErr },
    { data: abs, error: aErr },
    { data: wishes, error: wErr },
    { data: unav, error: unErr },
  ] = await Promise.all([
    supabase.from("users").select("id,name,email,role,status"),
    supabase.from("absences").select("user_id,type,start_date,end_date"),
    supabase.from("shift_wishes").select("user_id,weekday,time_slot"),
    supabase.from("unavailability_rules").select("user_id,weekday,time_slot"),
  ]);

  if (uErr) throw new Error("users: " + uErr.message);
  if (aErr) throw new Error("absences: " + aErr.message);
  if (wErr) throw new Error("shift_wishes: " + wErr.message);
  if (unErr) throw new Error("unavailability_rules: " + unErr.message);

  const userRows = (users ?? []) as DbUser[];
  const absRows = (abs ?? []) as DbAbsence[];
  const wishRows = (wishes ?? []) as DbWish[];
  const unavRows = (unav ?? []) as DbUnavail[];

  // 3) Name Mapping
  const idToName = new Map<string, string>();
  for (const u of userRows) {
    const name = (u.name ?? "").trim();
    if (name) idToName.set(u.id, name);
  }

  // 4) urlaub_by_name
  const urlaub_by_name: Record<string, [string, string][]> = {};
  for (const a of absRows) {
    const name = idToName.get(a.user_id);
    if (!name) continue;
    (urlaub_by_name[name] ??= []).push([a.start_date, a.end_date]);
  }
  for (const k of Object.keys(urlaub_by_name)) {
    urlaub_by_name[k].sort((x, y) => x[0].localeCompare(y[0]));
  }

  // 5) wuensche_by_name
  const wuensche_by_name: Record<string, [string, string][]> = {};
  for (const w of wishRows) {
    const name = idToName.get(w.user_id);
    if (!name) continue;
    const day = WD[w.weekday];
    const slot = slotToSolver(w.time_slot);
    if (!day) continue;
    (wuensche_by_name[name] ??= []).push([day, slot]);
  }
  for (const name of Object.keys(wuensche_by_name)) {
    const seen = new Set<string>();
    wuensche_by_name[name] = wuensche_by_name[name]
      .filter(([d, t]) => {
        const key = `${d}|${t}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]));
  }

  // 6) weekly_unavailable
  const perUserDay: Record<string, Record<string, { all: boolean; times: Set<string> }>> = {};
  for (const r of unavRows) {
    const name = idToName.get(r.user_id);
    if (!name) continue;
    const day = WD[r.weekday];
    if (!day) continue;

    perUserDay[name] ??= {};
    perUserDay[name][day] ??= { all: false, times: new Set<string>() };

    if (r.time_slot === null) {
      perUserDay[name][day].all = true;
      perUserDay[name][day].times.clear();
    } else if (!perUserDay[name][day].all) {
      perUserDay[name][day].times.add(slotToSolver(r.time_slot));
    }
  }

  const weekly_unavailable: Record<string, { days: string[]; times: "ALL" | string[] }[]> = {};
  for (const name of Object.keys(perUserDay)) {
    const dayMap = perUserDay[name];
    const allDays: string[] = [];
    const groupMap = new Map<string, string[]>(); // timesKey -> days

    for (const day of Object.keys(dayMap)) {
      const info = dayMap[day];
      if (info.all) {
        allDays.push(day);
      } else {
        const timesArr = Array.from(info.times).sort();
        const key = timesArr.join(",");
        if (!key) continue;
        (groupMap.get(key) ?? groupMap.set(key, []).get(key)!).push(day);
      }
    }

    const out: { days: string[]; times: "ALL" | string[] }[] = [];
    if (allDays.length) out.push({ days: allDays.sort(), times: "ALL" });
    for (const [key, days] of groupMap.entries()) out.push({ days: days.sort(), times: key.split(",") });

    if (out.length) weekly_unavailable[name] = out;
  }

  // 7) Template klonen + Felder überschreiben
  const next = structuredClone(template);

  // (optional) employees auto
  const AUTO_EMPLOYEES = false;
  if (AUTO_EMPLOYEES) {
    next.employees = userRows
      .filter((u) => u.role !== "admin")
      .map((u) => (u.name ?? "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "de"));
  }

  next.urlaub_by_name = inits(next.urlaub_by_name, {});
  next.wuensche_by_name = inits(next.wuensche_by_name, {});
  next.weekly_unavailable = inits(next.weekly_unavailable, {});

  next.urlaub_by_name = urlaub_by_name;
  next.wuensche_by_name = wuensche_by_name;
  next.weekly_unavailable = weekly_unavailable;

  return next;
}
