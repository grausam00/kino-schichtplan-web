"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getMe } from "@/lib/auth/getMe";

type Absence = {
  id: number;
  user_id: string;
  type: "urlaub" | "krank" | "sonstiges";
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  comment: string | null;
};

export default function MyAbsencesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  const [rows, setRows] = useState<Absence[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // Form
  const [type, setType] = useState<Absence["type"]>("urlaub");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [comment, setComment] = useState("");

  const canSubmit = useMemo(() => !!startDate && !!endDate, [startDate, endDate]);

  async function load() {
    setErr(null);
    const { data, error } = await supabase
      .from("absences")
      .select("id,user_id,type,start_date,end_date,comment")
      .order("start_date", { ascending: false });

    if (error) setErr(error.message);
    setRows((data as Absence[]) ?? []);
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

    const { error } = await supabase.from("absences").insert({
      user_id: profile.id, // RLS erlaubt nur eigenes (oder admin)
      type,
      start_date: startDate,
      end_date: endDate,
      comment: comment.trim() ? comment.trim() : null,
    });

    if (error) {
      setErr(error.message);
      return;
    }

    setStartDate("");
    setEndDate("");
    setComment("");
    setType("urlaub");
    await load();
  };

  const onDelete = async (id: number) => {
    setErr(null);
    const { error } = await supabase.from("absences").delete().eq("id", id);
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
        <h1 className="text-xl font-bold">Meine Abwesenheiten</h1>
        <p className="text-sm text-gray-600">Urlaub / Krank / Sonstiges</p>
      </header>

      <form onSubmit={onCreate} className="border rounded p-4 space-y-3 max-w-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm">Typ</label>
            <select className="w-full border rounded px-3 py-2" value={type} onChange={(e) => setType(e.target.value as any)}>
              <option value="urlaub">Urlaub</option>
              <option value="krank">Krank</option>
              <option value="sonstiges">Sonstiges</option>
            </select>
          </div>
          <div>
            <label className="text-sm">Kommentar (optional)</label>
            <input className="w-full border rounded px-3 py-2" value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          <div>
            <label className="text-sm">Von</label>
            <input className="w-full border rounded px-3 py-2" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm">Bis</label>
            <input className="w-full border rounded px-3 py-2" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </div>
        </div>

        {err && <p className="text-red-600 text-sm">Fehler: {err}</p>}

        <button className="bg-black text-white rounded px-4 py-2 disabled:opacity-60" disabled={!canSubmit} type="submit">
          Abwesenheit speichern
        </button>
      </form>

      <section className="space-y-2">
        <h2 className="font-semibold">Einträge</h2>
        <div className="border rounded divide-y">
          {rows.length === 0 ? (
            <div className="p-4 text-sm text-gray-600">Keine Einträge.</div>
          ) : (
            rows.map((a) => (
              <div key={a.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium">
                    {a.type.toUpperCase()} — {a.start_date} bis {a.end_date}
                  </div>
                  {a.comment && <div className="text-sm text-gray-600">{a.comment}</div>}
                </div>
                <button className="text-sm underline" onClick={() => onDelete(a.id)}>
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
