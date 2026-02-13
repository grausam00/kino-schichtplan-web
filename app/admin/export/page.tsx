"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe } from "@/lib/auth/getMe";
import { buildSolverExportJson } from "@/lib/api/exportSolverConfig";
import { downloadJson } from "@/lib/utils/download";

export default function AdminExportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { user, profile } = await getMe();
        if (!user) return router.replace("/login");
        if (profile?.role !== "admin") return router.replace("/plan");
      } catch (e) {
        console.error(e);
        setMsg("Fehler beim Auth-Check.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const onExport = async () => {
    setMsg(null);
    setExporting(true);
    try {
      const next = await buildSolverExportJson();
      const fileName = `solver_config_export_${new Date().toISOString().slice(0, 10)}.json`;
      downloadJson(fileName, next);
      setMsg("Export erstellt und heruntergeladen ✅");
    } catch (e: any) {
      setMsg("Fehler: " + (e?.message ?? String(e)));
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <main className="p-6">Lade…</main>;

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Admin Export</h1>
      <p className="text-sm text-gray-600">
        Exportiert deine Supabase-Daten in deine bestehende Solver-JSON-Struktur (Template bleibt erhalten).
      </p>

      {msg && <div className="text-sm">{msg}</div>}

      <button
        className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
        onClick={onExport}
        disabled={exporting}
      >
        {exporting ? "Export läuft…" : "Solver JSON exportieren"}
      </button>
    </main>
  );
}
