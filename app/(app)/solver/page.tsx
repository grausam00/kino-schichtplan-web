"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe } from "@/lib/auth/getMe";
import { supabase } from "@/lib/supabase/client";
import { applySolverConfigReplaceByOwner } from "@/lib/api/solverConfig";

type SolverConfigRow = { name: string };

export default function SolverPage() {
  const router = useRouter();

  const [meRole, setMeRole] = useState<"admin" | "mitarbeiter" | null>(null);
  const [configs, setConfigs] = useState<SolverConfigRow[]>([]);
  const [selected, setSelected] = useState<string>("default");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      const { user, profile } = (await getMe()) as any;
      if (!user) return router.replace("/login");
      setMeRole((profile?.role as any) ?? "mitarbeiter");

      const { data, error } = await supabase
        .from("solver_configs")
        .select("name")
        .order("name", { ascending: true });

      if (error) {
        setMsg(error.message);
        return;
      }

      const rows = (data ?? []) as SolverConfigRow[];
      setConfigs(rows);

      if (rows.length > 0) {
        const hasDefault = rows.some((r) => r.name === "default");
        setSelected(hasDefault ? "default" : rows[0].name);
      }
    })();
  }, [router]);

  async function onApply() {
    setMsg(null);
    setResult(null);

    if (meRole !== "admin") {
      setMsg("Nur Admin kann Solver-Configs anwenden.");
      return;
    }

    setLoading(true);
    try {
      const res = await applySolverConfigReplaceByOwner(selected);
      setResult(res);
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="p-6 space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-bold">Solver</h1>
        <p className="text-sm text-gray-600">
          Solver-Config anwenden (Replace-by-owner) – überschreibt Regeln der betroffenen Mitarbeitenden.
        </p>
        {msg && <p className="text-sm text-red-600">Fehler: {msg}</p>}
      </header>

      <section className="space-y-3 border rounded p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Config auswählen</label>
            <select
              className="border rounded px-3 py-2 min-w-[220px]"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {configs.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <button
            className="border rounded px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            disabled={loading || meRole !== "admin" || !selected}
            onClick={onApply}
            title={meRole !== "admin" ? "Nur Admin" : ""}
          >
            {loading ? "Wende an…" : "Config anwenden (überschreibt)"}
          </button>

          {meRole && (
            <div className="text-xs text-gray-500">
              Rolle: <span className="font-medium">{meRole}</span>
            </div>
          )}
        </div>

        <div className="text-xs text-gray-600">
          Betroffene Tabellen: <span className="font-medium">absences</span>,{" "}
          <span className="font-medium">shift_wishes</span>,{" "}
          <span className="font-medium">unavailability_rules</span>
        </div>
      </section>

      {result && (
        <section className="border rounded p-4 space-y-2">
          <div className="font-semibold">Ergebnis</div>
          <div className="text-sm text-gray-700">
            Owners: <span className="font-medium">{result.owners}</span>
          </div>
          <div className="text-sm text-gray-700">
            Absences: <span className="font-medium">{result.absences}</span>
          </div>
          <div className="text-sm text-gray-700">
            Wishes: <span className="font-medium">{result.wishes}</span>
          </div>
          <div className="text-sm text-gray-700">
            Unavailability: <span className="font-medium">{result.unavailability}</span>
          </div>
          {result.note && <div className="text-xs text-gray-500">{result.note}</div>}
        </section>
      )}
    </main>
  );
}
