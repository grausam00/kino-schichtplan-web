"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe } from "@/lib/auth/getMe";
import { usePlanWeek } from "@/lib/hooks/usePlanWeek";
import { useShiftActions } from "@/lib/hooks/useShiftActions";
import { formatDE, weekdayMonFirst } from "@/lib/domain/dates";
import { updateShiftMaxPersons } from "@/lib/db/shifts";

const SLOTS = ["14:00", "17:00", "20:00"] as const;

export default function PlanPage() {
  const router = useRouter();

  const [meId, setMeId] = useState<string | null>(null);
  const [meRole, setMeRole] = useState<"admin" | "mitarbeiter" | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);

  // Modal state
  const [selectedShift, setSelectedShift] = useState<any | null>(null);
  const [editMax, setEditMax] = useState<number>(0);

  const {
    loading,
    msg: loadMsg,
    weekStart,
    setWeekStart,
    allMondays,
    shifts,
    weekDates,
    loadWeek,
  } = usePlanWeek();

  useEffect(() => {
    (async () => {
      // getMe liefert bei dir i.d.R. { user, profile }
      const { user, profile } = (await getMe()) as any;
      if (!user) return router.replace("/login");
      setMeId(user.id);
      setMeRole((profile?.role as "admin" | "mitarbeiter") ?? "mitarbeiter");
    })();
  }, [router]);

  const { msg: actionMsg, setMsg: setActionMsg, join, cancel } = useShiftActions({
    meId,
    onChanged: async () => {
      if (weekStart) await loadWeek(weekStart);
    },
  });

  const msg = actionMsg ?? loadMsg;

  // Grid: date|slot -> shift
  const shiftByCell = useMemo(() => {
    const m = new Map<string, any>();
    for (const s of shifts) m.set(`${s.date}|${s.time_slot}`, s);
    return m;
  }, [shifts]);

  if (loading) return <main className="p-6">Lade Plan…</main>;

  function openShiftModal(shift: any) {
    setSelectedShift(shift);
    setEditMax(Number(shift?.max_persons ?? 0));
  }

  async function saveMaxPersons() {
    if (!selectedShift) return;

    try {
      const shift = selectedShift;
      const assigns = shift.assignments ?? [];
      const fixed = assigns.filter((a: any) => a.status === "fix");
      const pending = assigns.filter((a: any) => a.status === "freiwillig");

      const occupied = fixed.length + pending.length;
      const minP = Number(shift.min_persons ?? 0);

      // Safety: darf nicht < min_persons und nicht < belegte Plätze
      const next = Math.max(minP, occupied, Number(editMax ?? 0));

      await updateShiftMaxPersons(Number(shift.id), next);

      setSelectedShift(null);
      setActionMsg(null);

      if (weekStart) await loadWeek(weekStart);
    } catch (e: any) {
      setActionMsg(e?.message ?? String(e));
    }
  }

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
                setActionMsg(null);
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
            <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
            Nur meine Schichten (Anzeige)
          </label>

          {meRole && (
            <div className="text-xs text-gray-500">
              Rolle: <span className="font-medium">{meRole}</span>
            </div>
          )}
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

                    if (!shift) {
                      return (
                        <td key={`${d}|${slot}`} className="p-3 border-b">
                          <span className="text-gray-400 text-sm">—</span>
                        </td>
                      );
                    }

                    const assigns = shift.assignments ?? [];
                    const fixed = assigns.filter((a: any) => a.status === "fix");
                    const pending = assigns.filter((a: any) => a.status === "freiwillig");

                    const maxP = Number(shift.max_persons ?? 0);
                    const occupied = fixed.length + pending.length;
                    const free = Math.max(0, maxP - occupied);

                    const iAmFixed = fixed.some((a: any) => a.user_id === meId);
                    const iAmPending = pending.some((a: any) => a.user_id === meId);

                    const fixedNames = fixed.map((a: any) => a.users?.name ?? "???");
                    const pendingNames = pending.map((a: any) => a.users?.name ?? "???");

                    const myFixedNames = fixed
                      .filter((a: any) => a.user_id === meId)
                      .map((a: any) => a.users?.name ?? "Ich");
                    const myPendingNames = pending
                      .filter((a: any) => a.user_id === meId)
                      .map((a: any) => a.users?.name ?? "Ich");

                    const othersFixedCount = Math.max(0, fixedNames.length - myFixedNames.length);
                    const othersPendingCount = Math.max(0, pendingNames.length - myPendingNames.length);

                    return (
                      <td
                        key={`${d}|${slot}`}
                        className="p-3 border-b space-y-2 cursor-pointer hover:bg-gray-50"
                        onClick={() => openShiftModal(shift)}
                        title={meRole === "admin" ? "Klicken zum Bearbeiten (Max. Personen)" : "Details anzeigen"}
                      >
                        <div className="text-xs text-gray-600">
                          Plätze frei: <span className="font-medium">{free}</span> / {maxP}
                          {meRole === "admin" && (
                            <span className="ml-2 text-gray-400">(klicken zum Ändern)</span>
                          )}
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
                              {othersFixedCount > 0 && <div className="text-xs text-gray-500">+{othersFixedCount} weitere</div>}
                            </div>
                          ) : (
                            <ul className="space-y-1">
                              {fixedNames
                                .sort((a: string, b: string) => a.localeCompare(b, "de"))
                                .map((n: string) => (
                                  <li key={n} className="text-sm">
                                    {n}
                                  </li>
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
                              {othersPendingCount > 0 && <div className="text-xs text-gray-500">+{othersPendingCount} weitere</div>}
                            </div>
                          ) : (
                            <ul className="space-y-1">
                              {pendingNames
                                .sort((a: string, b: string) => a.localeCompare(b, "de"))
                                .map((n: string) => (
                                  <li key={n} className="text-sm">
                                    {n}
                                  </li>
                                ))}
                            </ul>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {free > 0 && !iAmFixed && !iAmPending && (
                            <button
                              className="border rounded px-2 py-1 text-xs hover:bg-gray-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                join(shift.id);
                              }}
                            >
                              Ich will diese Schicht
                            </button>
                          )}

                          {(iAmFixed || iAmPending) && (
                            <button
                              className="border rounded px-2 py-1 text-xs hover:bg-gray-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                cancel(shift.id);
                              }}
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

      {/* Modal */}
      {selectedShift && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setSelectedShift(null)}
        >
          <div
            className="bg-white rounded-lg shadow-lg w-full max-w-md p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold">
                {formatDE(selectedShift.date)} – {selectedShift.time_slot}
              </div>
              <button className="text-sm" onClick={() => setSelectedShift(null)}>
                ✕
              </button>
            </div>

            <div className="text-sm text-gray-600">
              Min: <span className="font-medium">{selectedShift.min_persons}</span>
              {" · "}
              Aktuell Max: <span className="font-medium">{selectedShift.max_persons}</span>
            </div>

            {meRole === "admin" ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Max. Personen</label>
                  <input
                    type="number"
                    className="border rounded px-3 py-2 w-full"
                    value={editMax}
                    min={0}
                    onChange={(e) => setEditMax(parseInt(e.target.value || "0", 10))}
                  />
                  <div className="text-xs text-gray-500">
                    Hinweis: Beim Speichern wird automatisch sichergestellt, dass Max nicht kleiner als Min oder belegte Plätze ist.
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button className="border rounded px-3 py-2 text-sm" onClick={() => setSelectedShift(null)}>
                    Abbrechen
                  </button>
                  <button
                    className="border rounded px-3 py-2 text-sm hover:bg-gray-50"
                    onClick={saveMaxPersons}
                  >
                    Speichern
                  </button>
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-600">Nur Admin kann die Maximalbesetzung ändern.</div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
