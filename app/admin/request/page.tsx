"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { requireAdminOrRedirect } from "@/lib/guards/requireAdminClient";
import { approveRequest, denyRequest, fetchOpenRequests, RequestRow } from "@/lib/api/adminRequests";

export default function AdminRequestPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<RequestRow[]>([]);

  const reload = async () => {
    const list = await fetchOpenRequests();
    setRows(list);
  };

  useEffect(() => {
    (async () => {
      try {
        const gate = await requireAdminOrRedirect(router);
        if (!gate.ok) return;
        await reload();
      } catch (e: any) {
        setMsg(e?.message ?? "Fehler beim Laden.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const onApprove = async (r: RequestRow) => {
    setMsg(null);
    setWorkingId(r.id);
    try {
      await approveRequest(r.id, r.shift_id);
      await reload();
      setMsg("Approved ✅");
    } catch (e: any) {
      setMsg(e?.message ?? "Approve fehlgeschlagen.");
    } finally {
      setWorkingId(null);
    }
  };

  const onDeny = async (r: RequestRow) => {
    setMsg(null);
    setWorkingId(r.id);
    try {
      await denyRequest(r.id);
      await reload();
      setMsg("Abgelehnt ✅");
    } catch (e: any) {
      setMsg(e?.message ?? "Ablehnen fehlgeschlagen.");
    } finally {
      setWorkingId(null);
    }
  };

  if (loading) return <main className="p-6">Lade…</main>;

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Admin – Anfragen</h1>

      {msg && <div className="text-sm">{msg}</div>}

      {rows.length === 0 ? (
        <div className="text-sm text-gray-600">Keine offenen Anfragen.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="border rounded p-3 flex items-center justify-between gap-3">
              <div className="text-sm">
                <div className="font-medium">
                  {r.user_name ?? r.user_id}
                </div>
                <div className="text-gray-600">
                  {r.shift_date ?? "?"} • {r.shift_time_slot ?? "?"} • max {r.shift_max_persons ?? "?"}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  className="px-3 py-1 rounded bg-black text-white disabled:opacity-50"
                  onClick={() => onApprove(r)}
                  disabled={workingId === r.id}
                >
                  {workingId === r.id ? "…" : "Approve"}
                </button>
                <button
                  className="px-3 py-1 rounded border disabled:opacity-50"
                  onClick={() => onDeny(r)}
                  disabled={workingId === r.id}
                >
                  {workingId === r.id ? "…" : "Ablehnen"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
