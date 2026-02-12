"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getMe } from "@/lib/auth/getMe";

type TimeSlot = "14:00" | "17:00" | "20:00";

type Rule = {
  id: number;
  user_id: string;
  weekday: number; // 1..7
  time_slot: TimeSlot | null; // null = ganztägig
  comment: string | null;
  created_at: string;
};

const WD: Record<number, string> = { 1: "Mo", 2: "Di", 3: "Mi", 4: "Do", 5: "Fr", 6: "Sa", 7: "So" };
const SLOTS: TimeSlot[] = ["14:00", "17:00", "20:00"];

export default function UnavailabilityRulesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  const [rows, setRows] = useState<Rule[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // Form
  const [weekday, setWeekday] = useState(1);
  const [allDay, setAllDay] = useState(true);
  const [timeSlot, setTimeSlot] = useState<TimeSlot>("14:00");
  const [comment, setComment] = useState("");

  const canSubmit = useMemo(() => {
    if (allDay) return true;
    return !!timeSlot;
  }, [allDay, timeSlot]);

  async function load() {
    setErr(null);
    const { data, error } = await supabase
      .from("unavailability_rules")
      .select("id,user_id,weekday,time_slot,comment,created_at")
      .order("weekday", { ascending: true })
      .order("time_slot", { ascending: true });

    if (error) setErr(error.message);
    setRows((data as Rule[]) ?? []);
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

    const payload = {
      user_id: profile.id,
      weekday,
      time_slot: allDay ? null : timeSlot,
      comment: comment.trim() ? comment.trim() : null,
    };

    const { error } = await supabase.from("unavailability_rules").insert(payload);
    if (error) {
      setErr(error.message);
      return;
    }

    setAllDay(true);
    setTimeSlot("14:00");
    setComment("");
    await load();
  };

  const onDelete = async (id: number) => {
    setErr(null);
    const { error } = await supabase.from("unavailability_rules").delete().eq("id", id);
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
        <h1 className="text-xl font-bold">Unverfügbarkeiten</h1>
        <p className="text-sm text-gray-600">Wiederkehrend: Wochentag + ganztägig oder Slot (14/17/20)</p>
      </header>

      <form onSubmit={onCreate} className="border rounded p-4 space-y-3 max-w-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm">Wochentag</label>
            <select className="w-full border rounded px-3 py-2" value={weekday} onChange={(e) => setWeekday(parseInt(e.target.value, 10))}>
              {Object.entries(WD).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
              Ganztägig
            </label>
          </div>

          {!allDay && (
            <div>
              <label className="text-sm">Slot</label>
              <select className="w-full border rounded px-3 py-2" value={timeSlot} onChange={(e) => setTimeSlot(e.target.value as TimeSlot)}>
                {SLOTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}

          <div className={allDay ? "md:col-span-2" : ""}>
            <label className="text-sm">Kommentar (optional)</label>
            <input className="w-full border rounded px-3 py-2" value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
        </div>

        {err && <p className="text-red-600 text-sm">Fehler: {err}</p>}

        <button className="bg-black text-white rounded px-4 py-2 disabled:opacity-60" disabled={!canSubmit} type="submit">
          Regel speichern
        </button>
      </form>

      <section className="space-y-2">
        <h2 className="font-semibold">Regeln</h2>
        <div className="border rounded divide-y">
          {rows.length === 0 ? (
            <div className="p-4 text-sm text-gray-600">Keine Regeln.</div>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium">
                    {WD[r.weekday]} — {r.time_slot === null ? "ganztägig" : r.time_slot}
                  </div>
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
