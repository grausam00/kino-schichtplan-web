"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getMe } from "@/lib/auth/getMe";

type DbUser = { id: string; name: string | null; email: string; role: string; status: string };
type DbAbsence = { user_id: string; type: string; start_date: string; end_date: string };
type DbWish = { user_id: string; weekday: number; time_slot: string }; // time_slot '14:00' etc
type DbUnavail = { user_id: string; weekday: number; time_slot: string | null }; // null = ALLDAY

const WD: Record<number, string> = { 1: "Mo", 2: "Di", 3: "Mi", 4: "Do", 5: "Fr", 6: "Sa", 7: "So" };

function slotToSolver(slot: string) {
  // '14:00' -> '14'
  return slot.replace(":00", "");
}

function downloadJson(filename: string, obj: any) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminExportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { user, profile } = await getMe();
      if (!user) return router.replace("/login");
      if (profile?.role !== "admin") return router.replace("/plan");
      setProfile(profile);
      setLoading(false);
    })();
  }, [router]);

  const onExport = async () => {
    setMsg(null);
    try {
      // 1) Template laden
      const tplRes = await fetch("/solver_template.json", { cache: "no-store" });
      if (!tplRes.ok) throw new Error("Konnte /solver_template.json nicht laden. Liegt die Datei in public/?");
      const template = await tplRes.json();

      // 2) Supabase Daten laden
      const [{ data: users, error: uErr }, { data: abs, error: aErr }, { data: wishes, error: wErr }, { data: unav, error: unErr }] =
        await Promise.all([
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

      // Name-Mapping
      const idToName = new Map<string, string>();
      for (const u of userRows) {
        const name = (u.name ?? "").trim();
        if (name) idToName.set(u.id, name);
      }

      // 3) urlaub_by_name (wir nehmen alle absences-Typen als harte Abwesenheit)
      const urlaub_by_name: Record<string, [string, string][]> = {};
      for (const a of absRows) {
        const name = idToName.get(a.user_id);
        if (!name) continue;
        if (!urlaub_by_name[name]) urlaub_by_name[name] = [];
        urlaub_by_name[name].push([a.start_date, a.end_date]);
      }
      // optional: sort
      for (const k of Object.keys(urlaub_by_name)) {
        urlaub_by_name[k].sort((x, y) => x[0].localeCompare(y[0]));
      }

      // 4) wuensche_by_name: [ ["Sa","14"], ... ]
      const wuensche_by_name: Record<string, [string, string][]> = {};
      for (const w of wishRows) {
        const name = idToName.get(w.user_id);
        if (!name) continue;
        const day = WD[w.weekday];
        const slot = slotToSolver(w.time_slot);
        if (!day) continue;
        if (!wuensche_by_name[name]) wuensche_by_name[name] = [];
        wuensche_by_name[name].push([day, slot]);
      }
      // dedupe
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

      // 5) weekly_unavailable
      // Erst sammeln: pro Name -> pro Day -> ALL oder Set(times)
      const perUserDay: Record<string, Record<string, { all: boolean; times: Set<string> }>> = {};
      for (const r of unavRows) {
        const name = idToName.get(r.user_id);
        if (!name) continue;
        const day = WD[r.weekday];
        if (!day) continue;

        if (!perUserDay[name]) perUserDay[name] = {};
        if (!perUserDay[name][day]) perUserDay[name][day] = { all: false, times: new Set<string>() };

        if (r.time_slot === null) {
          perUserDay[name][day].all = true;
          perUserDay[name][day].times.clear();
        } else if (!perUserDay[name][day].all) {
          perUserDay[name][day].times.add(slotToSolver(r.time_slot));
        }
      }

      // Dann in Solver-Format gruppieren:
      // - alle ALL-day Tage zusammen
      // - sonst nach identischem times-set zusammen
      const weekly_unavailable: Record<
        string,
        { days: string[]; times: "ALL" | string[] }[]
      > = {};

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
            if (!key) continue; // keine Sperre
            if (!groupMap.has(key)) groupMap.set(key, []);
            groupMap.get(key)!.push(day);
          }
        }

        const out: { days: string[]; times: "ALL" | string[] }[] = [];
        if (allDays.length) out.push({ days: allDays.sort(), times: "ALL" });

        for (const [key, days] of groupMap.entries()) {
          out.push({ days: days.sort(), times: key.split(",") });
        }

        if (out.length) weekly_unavailable[name] = out;
      }

      // 6) Optional: employees aus DB bauen (nur wenn du das willst)
      // Ich überschreibe nur, wenn template.employees NICHT gepflegt werden soll.
      // -> Standard: wir lassen template.employees wie es ist.
      // Wenn du es automatisch willst, setz AUTO_EMPLOYEES = true.
      const AUTO_EMPLOYEES = false;

      const next = structuredClone(template);

      if (AUTO_EMPLOYEES) {
        next.employees = userRows
          .filter((u) => u.role !== "admin")
          .map((u) => (u.name ?? "").trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, "de"));
      }

      // 7) Überschreiben der dynamischen Bereiche
      next.urlaub_by_name = urlaub_by_name;
      next.wuensche_by_name = wuensche_by_name;
      next.weekly_unavailable = weekly_unavailable;

      // 8) Download
      const fileName = `solver_config_export_${new Date().toISOString().slice(0, 10)}.json`;
      downloadJson(fileName, next);
      setMsg("Export erstellt und heruntergeladen ✅");
    } catch (e: any) {
      setMsg("Fehler: " + (e?.message ?? String(e)));
    }
  };

  if (loading) return <main className="p-6">Lade…</main>;

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Admin Export</h1>
      <p className="text-sm text-gray-600">
        Exportiert deine Supabase-Daten in deine bestehende Solver-JSON-Struktur (Template bleibt erhalten).
      </p>

      {msg && <div className="text-sm">{msg}</div>}

      <button className="bg-black text-white rounded px-4 py-2" onClick={onExport}>
        Solver JSON exportieren
      </button>
    </main>
  );
}
