"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getCurrentUserAndProfile } from "@/lib/api/auth";
import { createWish, deleteWishById, listWishesByUser } from "@/lib/api/wishes";
import {
  buildCreateWishInput,
  SLOTS,
  WEEKDAYS,
  type TimeSlot,
  type WishRow,
} from "@/lib/rules/wishes";

export default function MyWishesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [rows, setRows] = useState<WishRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [weekday, setWeekday] = useState<number>(6); // default Sa
  const [timeSlot, setTimeSlot] = useState<TimeSlot>("17:00");

  const canSubmit = useMemo(() => weekday >= 1 && weekday <= 7, [weekday]);

  async function reload(uid: string) {
    setErr(null);
    try {
      const data = await listWishesByUser(uid);
      setRows(data);
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

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setErr(null);

    const built = buildCreateWishInput({
      userId,
      weekday,
      timeSlot,
      existing: rows,
    });

    if (!built.ok) {
      setErr(built.error);
      return;
    }

    try {
      await createWish(built.value);
      await reload(userId);
    } catch (e: any) {
      setErr(e?.message ?? "Fehler beim Speichern.");
    }
  };

  const onDelete = async (id: number) => {
    if (!userId) return;
    setErr(null);

    try {
      await deleteWishById(id);
      await reload(userId);
    } catch (e: any) {
      setErr(e?.message ?? "Fehler beim Löschen.");
    }
  };

  if (loading) return <main className="p-6">Lade…</main>;

  return (
    <main className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-bold">Meine Wunschschichten</h1>
        <p className="text-sm text-gray-600">Wiederkehrend: Wochentag + Slot</p>
      </header>

      <form onSubmit={onCreate} className="border rounded p-4 space-y-3 max-w-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

          <div>
            <label className="text-sm">Uhrzeit</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={timeSlot}
              onChange={(e) => setTimeSlot(e.target.value as TimeSlot)}
            >
              {SLOTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {err && <p className="text-red-600 text-sm">Fehler: {err}</p>}

        <button
          className="bg-black text-white rounded px-4 py-2 disabled:opacity-60"
          disabled={!canSubmit}
          type="submit"
        >
          Wunsch speichern
        </button>
      </form>

      <section className="space-y-2">
        <h2 className="font-semibold">Wünsche</h2>

        <div className="border rounded divide-y">
          {rows.length === 0 ? (
            <div className="p-4 text-sm text-gray-600">Keine Wünsche.</div>
          ) : (
            rows.map((w) => (
              <div key={w.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium">
                    {WEEKDAYS[w.weekday]} — {w.time_slot}
                  </div>
                  <div className="text-xs text-gray-500">ID: {w.id}</div>
                </div>

                <button className="text-sm underline" onClick={() => onDelete(w.id)}>
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
