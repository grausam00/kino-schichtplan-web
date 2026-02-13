"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getMe } from "@/lib/auth/getMe";

type AssignmentRow = {
  date: string;       // "YYYY-MM-DD"
  time_slot: string;  // "14:00" | "17:00" | "20:00"
  users: { name: string } | null;
};

const SLOTS = ["14:00", "17:00", "20:00"] as const;
const WD_MON = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

function dateUTC(isoDate: string) {
  // isoDate: "YYYY-MM-DD"
  return new Date(isoDate + "T00:00:00Z");
}

function isoUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}

function weekdayMonFirst(isoDate: string) {
  const d = dateUTC(isoDate);
  const js = d.getUTCDay(); // So=0, Mo=1, ...
  const idx = (js + 6) % 7; // Mo=0 ... So=6
  return WD_MON[idx];
}

function mondayOfWeek(isoDate: string) {
  const d = dateUTC(isoDate);
  const day = d.getUTCDay(); // So=0, Mo=1, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return isoUTC(d); // "YYYY-MM-DD" (Montag)
}

function weekDatesFromMonday(mondayIso: string) {
  const start = dateUTC(mondayIso);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    out.push(isoUTC(d));
  }
  return out; // Mo..So
}

// Anzeige in DE (ohne Day-Shift)
function formatDE(isoDate: string) {
  // Trick: mittags UTC, damit es nie in den Vortag rutscht
  const d = new Date(isoDate + "T12:00:00Z");
  return d.toLocaleDateString("de-DE");
}

// erzeugt IMMER exakt Mo..So für eine Woche (ausgehend von beliebigem Datum)
function weekDatesFromAnyDate(anyIsoDate: string) {
  const mon = mondayOfWeek(anyIsoDate);
  const start = new Date(mon + "T00:00:00");
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out; // Mo..So
}

export default function PlanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [weekStart, setWeekStart] = useState<string | null>(null); // wir speichern hier den Montag (ISO)

  useEffect(() => {
    (async () => {
      const { user } = await getMe();
      if (!user) return router.replace("/login");

      const { data, error } = await supabase
        .from("assignments")
        .select("date,time_slot,users(name)")
        .order("date", { ascending: true })
        .order("time_slot", { ascending: true });

      if (error) {
        setMsg(error.message);
        setLoading(false);
        return;
      }

      const list: AssignmentRow[] = (data ?? []).map((r: any) => ({
        date: r.date,
        time_slot: r.time_slot,
        users: r.users ?? null,
      }));

      setRows(list);

      // Default: Woche der ersten vorhandenen Schicht
      const dates = Array.from(new Set(list.map((r) => r.date))).sort();
      setWeekStart(dates[0] ? mondayOfWeek(dates[0]) : null);

      setLoading(false);
    })();
  }, [router]);

  // Dropdown: alle Montage aus den Daten
  const weekStarts = useMemo(() => {
    const dates = Array.from(new Set(rows.map((r) => r.date))).sort();
    const mondays = new Set(dates.map(mondayOfWeek));
    return Array.from(mondays).sort();
  }, [rows]);


  // Grid Map: "YYYY-MM-DD|14:00" -> ["Name1","Name2"]
  const grid = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of rows) {
      const k = `${r.date}|${r.time_slot}`;
      const name = r.users?.name ?? "???";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(name);
    }
    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => a.localeCompare(b, "de"));
      m.set(k, arr);
    }
    return m;
  }, [rows]);

  // Spalten IMMER Mo..So (ausgehend von weekStart)
  const weekDates = useMemo(() => {
    if (!weekStart) return [];
    const mon = mondayOfWeek(weekStart); // falls doch mal kein Montag drin ist
    return weekDatesFromMonday(mon);
  }, [weekStart]);


  if (loading) return <main className="p-6">Lade Plan…</main>;

  return (
    <main className="p-6 space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-bold">Schichtplan</h1>
        {msg && <p className="text-sm text-red-600">Fehler: {msg}</p>}
      </header>

      <div className="flex items-center gap-3">
        <label className="text-sm">Woche (Start = Montag)</label>
        <select
          className="border rounded px-3 py-2"
          value={weekStart ?? ""}
          onChange={(e) => setWeekStart(e.target.value)}
        >
          {weekStarts.map((ws) => (
            <option key={ws} value={ws}>
              {formatDE(ws)}
            </option>
          ))}
        </select>
      </div>

      {!weekStart ? (
        <div className="text-sm text-gray-600">Keine Daten vorhanden.</div>
      ) : (
        <div className="overflow-auto border rounded">
          <table className="min-w-[1100px] w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-3 text-left border-b">Zeit</th>
                {weekDates.map((d) => (
                  <th key={d} className="p-3 text-left border-b">
                    <div className="flex flex-col leading-tight">
                      <span className="font-medium">{weekdayMonFirst(d)}</span>
                      <span className="text-gray-500 text-sm font-normal">{formatDE(d)}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {SLOTS.map((slot) => (
                <tr key={slot} className="align-top">
                  <td className="p-3 border-b font-medium">{slot.replace(":00", "")}</td>
                  {weekDates.map((d) => {
                    const names = grid.get(`${d}|${slot}`) ?? [];
                    return (
                      <td key={`${d}|${slot}`} className="p-3 border-b">
                        {names.length === 0 ? (
                          <span className="text-gray-400 text-sm">—</span>
                        ) : (
                          <ul className="space-y-1">
                            {names.map((n) => (
                              <li key={n} className="text-sm">{n}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
