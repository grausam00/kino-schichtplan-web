"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUserAndProfile } from "@/lib/api/auth";
import { createAbsence, deleteAbsenceById, listAbsencesByUser } from "@/lib/api/absences";
import { buildCreateAbsenceInput, type AbsenceRow, type AbsenceType } from "@/lib/rules/absences";

export default function MyAbsencesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);

  const [rows, setRows] = useState<AbsenceRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // Form
  const [type, setType] = useState<AbsenceType>("urlaub");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [comment, setComment] = useState("");

  const canSubmit = useMemo(() => !!startDate && !!endDate, [startDate, endDate]);

  async function reload(userId: string) {
    setErr(null);
    try {
      const data = await listAbsencesByUser(userId);
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

      // in deinem Projekt scheint profile.id die User-UUID zu sein
      const pid = (profile?.id as string) || user.id;

      setProfileId(pid);
      await reload(pid);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileId) return;

    setErr(null);

    const built = buildCreateAbsenceInput({
      userId: profileId,
      type,
      startDate,
      endDate,
      commentRaw: comment,
    });

    if (!built.ok) {
      setErr(built.error);
      return;
    }

    try {
      await createAbsence(built.value);

      setStartDate("");
      setEndDate("");
      setComment("");
      setType("urlaub");

      await reload(profileId);
    } catch (e: any) {
      setErr(e?.message ?? "Fehler beim Speichern.");
    }
  };

  const onDelete = async (id: number) => {
    if (!profileId) return;
    setErr(null);

    try {
      await deleteAbsenceById(id);
      await reload(profileId);
    } catch (e: any) {
      setErr(e?.message ?? "Fehler beim Löschen.");
    }
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
            <select
              className="w-full border rounded px-3 py-2"
              value={type}
              onChange={(e) => setType(e.target.value as AbsenceType)}
            >
              <option value="urlaub">Urlaub</option>
              <option value="krank">Krank</option>
              <option value="sonstiges">Sonstiges</option>
            </select>
          </div>

          <div>
            <label className="text-sm">Kommentar (optional)</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm">Von</label>
            <input
              className="w-full border rounded px-3 py-2"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-sm">Bis</label>
            <input
              className="w-full border rounded px-3 py-2"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
        </div>

        {err && <p className="text-red-600 text-sm">Fehler: {err}</p>}

        <button
          className="bg-black text-white rounded px-4 py-2 disabled:opacity-60"
          disabled={!canSubmit}
          type="submit"
        >
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
