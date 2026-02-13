"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getCurrentUserAndProfile } from "@/lib/api/auth";
import {
  createUnavailabilityRulesBulk,
  deleteUnavailabilityRuleById,
  listUnavailabilityRulesByUser,
} from "@/lib/api/unavailabilityRules";

import {
  SLOTS,
  WEEKDAYS,
  ruleLabel,
  buildCreateRulesBulk,
  type TimeSlot,
  type UnavailabilityRuleRow,
} from "@/lib/rules/unavailabilityRules";

export default function UnverfuegbarkeitenPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [rows, setRows] = useState<UnavailabilityRuleRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // Form
  const [weekday, setWeekday] = useState<number>(1);
  const [allDay, setAllDay] = useState<boolean>(true);
  const [selectedSlots, setSelectedSlots] = useState<Record<TimeSlot, boolean>>({
    "14:00": false,
    "17:00": true,
    "20:00": false,
  });
  const [comment, setComment] = useState("");

  const sortedRows = useMemo(() => {
    const rank = (r: UnavailabilityRuleRow) => (r.time_slot === null ? 0 : 1);
    return [...rows].sort((a, b) => {
      if (a.weekday !== b.weekday) return a.weekday - b.weekday;
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      return (a.time_slot ?? "").localeCompare(b.time_slot ?? "");
    });
  }, [rows]);

  async function reload(uid: string) {
    setErr(null);
    try {
      setRows(await listUnavailabilityRulesByUser(uid));
    } catch (e: any) {
      setErr(e?.message ?? "Fehler beim Laden.");
    }
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      const { user, profile } = await getCurrentUserAndProfile();
      if (!alive) return;

      if (!user) {
        router.replace("/login");
        return;
      }

      const uid = (profile?.id as string) || user.id;
      setUserId(uid);

      await reload(uid);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  function toggleSlot(slot: TimeSlot) {
    setSelectedSlots((prev) => ({ ...prev, [slot]: !prev[slot] }));
  }

  const chosenSlots = useMemo(
    () => SLOTS.filter((s) => selectedSlots[s]),
    [selectedSlots]
  );

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    setErr(null);

    const built = buildCreateRulesBulk({
      userId,
      weekday,
      allDay,
      slots: chosenSlots,
      commentRaw: comment,
      existing: rows,
    });

    if (!built.ok) {
      setErr(built.error);
      return;
    }

    try {
      await createUnavailabilityRulesBulk(built.value);

      // UX: Kommentar behalten oft sinnvoll, aber ich leere ihn
      setComment("");
      await reload(userId);
    } catch (e: any) {
      setErr(e?.message ?? "Fehler beim Speichern.");
    }
  }

  async function onDelete(id: number) {
    if (!userId) return;
    setErr(null);
    try {
      await deleteUnavailabilityRuleById(id);
      await reload(userId);
    } catch (e: any) {
      setErr(e?.message ?? "Fehler beim Löschen.");
    }
  }

  if (loading) return <main className="p-6">Lade…</main>;

  return (
    <main className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-bold">Unverfügbarkeiten (regelmäßig)</h1>
        <p className="text-sm text-gray-600">
          Beispiel: „Jeden Montag ganztägig“ oder „Jeden Freitag nur 20:00“.
        </p>
      </header>

      <form onSubmit={onCreate} className="border rounded p-4 space-y-4 max-w-xl">
        <div>
          <label className="text-sm">Wochentag</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={weekday}
            onChange={(e) => setWeekday(parseInt(e.target.value, 10))}
          >
            {Object.entries(WEEKDAYS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
          />
          <span>Ganztägig</span>
        </label>

        <div className={allDay ? "opacity-50 pointer-events-none" : ""}>
          <div className="text-sm mb-2">Slots</div>
          <div className="flex flex-wrap gap-3">
            {SLOTS.map((s) => (
              <label key={s} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedSlots[s]}
                  onChange={() => toggleSlot(s)}
                  disabled={allDay}
                />
                <span>{s}</span>
              </label>
            ))}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Tipp: Mehrere Slots auswählen → mehrere Regeln werden gespeichert.
          </div>
        </div>

        <div>
          <label className="text-sm">Kommentar (optional)</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        {err && <p className="text-red-600 text-sm">Fehler: {err}</p>}

        <button className="bg-black text-white rounded px-4 py-2" type="submit">
          Regel(n) speichern
        </button>
      </form>

      <section className="space-y-2">
        <h2 className="font-semibold">Meine Regeln</h2>

        <div className="border rounded divide-y">
          {sortedRows.length === 0 ? (
            <div className="p-4 text-sm text-gray-600">Keine Regeln.</div>
          ) : (
            sortedRows.map((r) => (
              <div key={r.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium">{ruleLabel(r)}</div>
                  {r.comment && <div className="text-sm text-gray-600">{r.comment}</div>}
                </div>

                <button className="text-sm underline" onClick={() => onDelete(r.id)}>
                  Löschen
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
