"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getMe } from "@/lib/auth/getMe";

type TimeSlot = "14:00" | "17:00" | "20:00";

type Wish = {
  id: number;
  user_id: string;
  weekday: number; // 1..7
  time_slot: TimeSlot;
  created_at: string;
};

const SLOTS: TimeSlot[] = ["14:00", "17:00", "20:00"];
const WD: Record<number, string> = { 1: "Mo", 2: "Di", 3: "Mi", 4: "Do", 5: "Fr", 6: "Sa", 7: "So" };

export default function MyWishesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  const [rows, setRows] = useState<Wish[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [weekday, setWeekday] = useState<number>(6); // default Sa
  const [timeSlot, setTimeSlot] = useState<TimeSlot>("17:00");

  const canSubmit = useMemo(() => weekday >= 1 && weekday <= 7, [weekday]);

  async function load() {
    setErr(null);
    const { data, error } = await supabase
      .from("shift_wishes")
      .select("id,user_id,weekday,time_slot,created_at")
      .order("weekday", { ascending: true })
      .order("time_slot", { ascending: true });

    if (error) setErr(error.message);
    setRows((data as Wish[]) ?? []);
  }

  useEffect(() => {
    (async () => {
      const { user, profile } = await getMe();
      if (!user) return router.replace("/login");
      setProfile(profile);
      await load();
      setLoading(false);
    })();
  }, [router]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    const { error } = await supabase.from("shift_wishes").insert({
      user_id: profile.id,
      weekday,
      time_slot: timeSlot,
    });

    if (error) {
      setErr(error.message);
      return;
    }

    await load();
  };

  const onDelete = async (id: number) => {
    setErr(null);
    const { error } = await supabase.from("shift_wishes").delete().eq("id", id);
    if (error) {
      setErr(error.message);
      return;
    }
    await load();
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
              {Object.entries(WD).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
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
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {err && <p className="text-red-600 text-sm">Fehler: {err}</p>}

        <button className="bg-black text-white rounded px-4 py-2 disabled:opacity-60" disabled={!canSubmit} type="submit">
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
                <div className="font-medium">
                  {WD[w.weekday]} — {w.time_slot}
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
