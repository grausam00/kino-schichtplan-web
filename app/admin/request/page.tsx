"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getMe } from "@/lib/auth/getMe";

type ReqRow = {
  id: number;
  status: string;
  user_id: string;
  shift_id: number;
  created_at: string;
  users: { name: string } | null;
  shifts: { date: string; time_slot: string } | null;
};

function formatDE(isoDate: string) {
  const d = new Date(isoDate + "T12:00:00Z");
  return d.toLocaleDateString("de-DE");
}

export default function AdminRequestsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<ReqRow[]>([]);

  const load = async () => {
    setLoading(true);
    setMsg(null);

    const { data, error } = await supabase
      .from("assignments")
      .select(`
        id,
        status,
        user_id,
        shift_id,
        created_at,
        users ( name ),
        shifts ( date, time_slot )
      `)
      .eq("status", "freiwillig")
      .order("created_at", { ascending: true });

    if (error) {
      setMsg(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const { user, profile } = await getMe();
      if (!user) return router.replace("/login");

      // wenn du Role-Gating schon hast:
      if (profile?.role !== "admin") return router.replace("/plan");

      await load();
    })();
  }, [router]);

  const approve = async (row: ReqRow) => {
    setMsg(null);

    // optional: Kapazität prüfen (max_persons vs fix count)
    // MVP: einfach setzen
    const { error } = await supabase
      .from("assignments")
      .update({ status: "fix" })
      .eq("id", row.id)
      .eq("status", "freiwillig");

    if (error) {
      setMsg(error.message);
      return;
    }

    await load();
  };

  const reject = async (row: ReqRow) => {
    setMsg(null);

    const { error } = await supabase
      .from("assignments")
      .update({ status: "abgesagt" })
      .eq("id", row.id)
      .eq("status", "freiwillig");

    if (error) {
      setMsg(error.message);
      return;
    }

    await load();
  };

  if (loading) return <main className="p-6">Lade Anfragen…</main>;

  return (
    <main className="p-6 space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-bold">Admin: Schicht-Anfragen</h1>
        {msg && <p className="text-sm text-red-600">Fehler: {msg}</p>}
      </header>

      {rows.length === 0 ? (
        <div className="text-sm text-gray-600">Keine offenen Anfragen 🎉</div>
      ) : (
        <div className="overflow-auto border rounded">
          <table className="min-w-[900px] w-full border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left border-b">Datum</th>
                <th className="p-3 text-left border-b">Slot</th>
                <th className="p-3 text-left border-b">Mitarbeiter</th>
                <th className="p-3 text-left border-b">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="p-3 border-b">
                    {r.shifts?.date ? formatDE(r.shifts.date) : "?"}
                  </td>
                  <td className="p-3 border-b">
                    {r.shifts?.time_slot ? r.shifts.time_slot.replace(":00", "") : "?"}
                  </td>
                  <td className="p-3 border-b">{r.users?.name ?? "???"}</td>
                  <td className="p-3 border-b">
                    <div className="flex gap-2">
                      <button
                        className="border rounded px-3 py-1 text-sm hover:bg-gray-50"
                        onClick={() => approve(r)}
                      >
                        Bestätigen
                      </button>
                      <button
                        className="border rounded px-3 py-1 text-sm hover:bg-gray-50"
                        onClick={() => reject(r)}
                      >
                        Ablehnen
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
