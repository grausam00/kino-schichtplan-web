"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getMe } from "@/lib/auth/getMe";

type ShiftRow = {
  id: number;
  date: string;       // "YYYY-MM-DD"
  time_slot: string;  // "14:00" | "17:00" | "20:00"
  min_persons: number | null;
  max_persons: number | null;
  assignments?: Array<{
    id: number;
    status: string; // "fix" | "freiwillig" | "abgesagt" | ...
    user_id: string;
    users: { name: string } | null;
  }> | null;
};

const SLOTS = ["14:00", "17:00", "20:00"] as const;
const WD_MON = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

// ---------- Date helpers (UTC-safe) ----------
function dateUTC(isoDate: string) {
  return new Date(isoDate + "T00:00:00Z");
}
function isoUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}
function weekdayMonFirst(isoDate: string) {
  const d = dateUTC(isoDate);
  const js = d.getUTCDay();         // So=0, Mo=1, ...
  const idx = (js + 6) % 7;         // Mo=0 ... So=6
  return WD_MON[idx];
}
function mondayOfWeek(isoDate: string) {
  const d = dateUTC(isoDate);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return isoUTC(d);
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
function formatDE(isoDate: string) {
  const d = new Date(isoDate + "T12:00:00Z"); // stabil
  return d.toLocaleDateString("de-DE");
}

// ---------- Page ----------
export default function PlanPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [meId, setMeId] = useState<string | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);

  const [weekStart, setWeekStart] = useState<string | null>(null); // Montag ISO
  const [shifts, setShifts] = useState<ShiftRow[]>([]);

  // Daten laden (initial + bei weekStart / onlyMine NICHT nötig neu zu laden, nur Anzeige)
  const loadWeek = async (mondayIso: string) => {
    setLoading(true);
    setMsg(null);

    const weekDates = weekDatesFromMonday(mondayIso);
    const startIso = weekDates[0];
    const endIso = weekDates[6];

    const { data, error } = await supabase
      .from("shifts")
      .select(`
        id,
        date,
        time_slot,
        min_persons,
        max_persons,
        assignments (
          id,
          status,
          user_id,
          users ( name )
        )
      `)
      .gte("date", startIso)
      .lte("date", endIso)
      .order("date", { ascending: true })
      .order("time_slot", { ascending: true });

    if (error) {
      setMsg(error.message);
      setShifts([]);
      setLoading(false);
      return;
    }

    setShifts((data ?? []) as any);
    setLoading(false);
  };

  // Init: login check + default weekStart aus erster shift-date
  useEffect(() => {
    (async () => {
      const { user } = await getMe();
      if (!user) return router.replace("/login");
      setMeId(user.id);

      // erste Schicht holen um Default-Woche zu bestimmen
      const { data, error } = await supabase
        .from("shifts")
        .select("date")
        .order("date", { ascending: true })
        .limit(1);

      if (error) {
        setMsg(error.message);
        setLoading(false);
        return;
      }

      const firstDate = (data?.[0] as any)?.date as string | undefined;
      const mondayIso = firstDate ? mondayOfWeek(firstDate) : mondayOfWeek(isoUTC(new Date()));
      setWeekStart(mondayIso);
      await loadWeek(mondayIso);
    })();
  }, [router]);

  // Dropdown: Montage aus vorhandenen shifts ableiten (einmalig „gut genug“: aus geladenen Wochen + später erweiterbar)
  // Für MVP: Wir bauen Dropdown aus allen Montage-Daten aus DB (klein/ok).
  const [allMondays, setAllMondays] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("shifts")
        .select("date")
        .order("date", { ascending: true });

      const dates = Array.from(new Set((data ?? []).map((r: any) => r.date))).sort();
      const mondays = Array.from(new Set(dates.map(mondayOfWeek))).sort();
      setAllMondays(mondays);
    })();
  }, []);

  const weekDates = useMemo(() => (weekStart ? weekDatesFromMonday(weekStart) : []), [weekStart]);

  // Grid: date|slot -> ShiftRow
  const shiftByCell = useMemo(() => {
    const m = new Map<string, ShiftRow>();
    for (const s of shifts) {
      m.set(`${s.date}|${s.time_slot}`, s);
    }
    return m;
  }, [shifts]);

  const myNameIn = (s: ShiftRow) => {
    const a = (s.assignments ?? []).find((x) => x.user_id === meId && (x.status === "fix" || x.status === "freiwillig"));
    return a?.users?.name ?? null;
  };

  // Actions
  const actionJoin = async (shift: ShiftRow) => {
    if (!meId) return;

    // schon drin?
    const already = (shift.assignments ?? []).some((a) => a.user_id === meId && a.status !== "abgesagt");
    if (already) return;

    const { error } = await supabase.from("assignments").insert({
      shift_id: shift.id,
      user_id: meId,
      status: "freiwillig",
    });

    if (error) {
      setMsg(error.message);
      return;
    }

    // reload current week
    if (weekStart) await loadWeek(weekStart);
  };

  const actionCancel = async (shift: ShiftRow) => {
    if (!meId) return;

    const { error } = await supabase
      .from("assignments")
      .update({ status: "abgesagt" })
      .eq("shift_id", shift.id)
      .eq("user_id", meId)
      .in("status", ["fix", "freiwillig"]);

    if (error) {
      setMsg(error.message);
      return;
    }

    if (weekStart) await loadWeek(weekStart);
  };

  if (loading) return <main className="p-6">Lade Plan…</main>;

  return (
    <main className="p-6 space-y-4">
      <header className="space-y-2">
        <h1 className="text-xl font-bold">Schichtplan</h1>
        {msg && <p className="text-sm text-red-600">Fehler: {msg}</p>}

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <label className="text-sm">Woche (Start = Montag)</label>
            <select
              className="border rounded px-3 py-2"
              value={weekStart ?? ""}
              onChange={async (e) => {
                const ws = e.target.value;
                setWeekStart(ws);
                await loadWeek(ws);
              }}
            >
              {allMondays.map((ws) => (
                <option key={ws} value={ws}>
                  {formatDE(ws)}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={onlyMine}
              onChange={(e) => setOnlyMine(e.target.checked)}
            />
            Nur meine Schichten (Anzeige)
          </label>
        </div>
      </header>

      {!weekStart ? (
        <div className="text-sm text-gray-600">Keine Daten vorhanden.</div>
      ) : (
        <div className="overflow-auto border rounded">
          <table className="min-w-[1200px] w-full border-collapse">
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
                    const shift = shiftByCell.get(`${d}|${slot}`) ?? null;

                    // keine Schicht existiert (Admin kann später erstellen)
                    if (!shift) {
                      return (
                        <td key={`${d}|${slot}`} className="p-3 border-b">
                          <span className="text-gray-400 text-sm">—</span>
                        </td>
                      );
                    }

                    const assigns = shift.assignments ?? [];
                    const fixed = assigns.filter((a) => a.status === "fix");
                    const pending = assigns.filter((a) => a.status === "freiwillig");

                    const maxP = shift.max_persons ?? 0;
                    const free = Math.max(0, maxP - fixed.length);

                    const iAmFixed = fixed.some((a) => a.user_id === meId);
                    const iAmPending = pending.some((a) => a.user_id === meId);

                    // Anzeige-Namen
                    const fixedNames = fixed.map((a) => a.users?.name ?? "???");
                    const pendingNames = pending.map((a) => a.users?.name ?? "???");

                    const myFixedNames = fixed.filter((a) => a.user_id === meId).map((a) => a.users?.name ?? "Ich");
                    const myPendingNames = pending.filter((a) => a.user_id === meId).map((a) => a.users?.name ?? "Ich");

                    const othersFixedCount = Math.max(0, fixedNames.length - myFixedNames.length);
                    const othersPendingCount = Math.max(0, pendingNames.length - myPendingNames.length);

                    return (
                      <td key={`${d}|${slot}`} className="p-3 border-b space-y-2">
                        <div className="text-xs text-gray-600">
                          Plätze frei: <span className="font-medium">{free}</span> / {maxP}
                        </div>

                        {/* FIX */}
                        <div>
                          <div className="text-xs font-semibold">Fix</div>
                          {fixed.length === 0 ? (
                            <div className="text-sm text-gray-400">—</div>
                          ) : onlyMine ? (
                            <div className="text-sm">
                              {myFixedNames.length ? (
                                <div className="font-medium">{myFixedNames.join(", ")}</div>
                              ) : (
                                <div className="text-gray-400">—</div>
                              )}
                              {othersFixedCount > 0 && (
                                <div className="text-xs text-gray-500">+{othersFixedCount} weitere</div>
                              )}
                            </div>
                          ) : (
                            <ul className="space-y-1">
                              {fixedNames.sort((a, b) => a.localeCompare(b, "de")).map((n) => (
                                <li key={n} className="text-sm">{n}</li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {/* PENDING */}
                        <div>
                          <div className="text-xs font-semibold">Anfragen</div>
                          {pending.length === 0 ? (
                            <div className="text-sm text-gray-400">—</div>
                          ) : onlyMine ? (
                            <div className="text-sm">
                              {myPendingNames.length ? (
                                <div className="font-medium">{myPendingNames.join(", ")}</div>
                              ) : (
                                <div className="text-gray-400">—</div>
                              )}
                              {othersPendingCount > 0 && (
                                <div className="text-xs text-gray-500">+{othersPendingCount} weitere</div>
                              )}
                            </div>
                          ) : (
                            <ul className="space-y-1">
                              {pendingNames.sort((a, b) => a.localeCompare(b, "de")).map((n) => (
                                <li key={n} className="text-sm">{n}</li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {free > 0 && !iAmFixed && !iAmPending && (
                            <button
                              className="border rounded px-2 py-1 text-xs hover:bg-gray-50"
                              onClick={() => actionJoin(shift)}
                            >
                              Ich will diese Schicht
                            </button>
                          )}

                          {(iAmFixed || iAmPending) && (
                            <button
                              className="border rounded px-2 py-1 text-xs hover:bg-gray-50"
                              onClick={() => actionCancel(shift)}
                            >
                              Absagen
                            </button>
                          )}
                        </div>
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
