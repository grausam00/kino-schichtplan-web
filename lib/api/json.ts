"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe } from "@/lib/auth/getMe";
import { parseJson } from "@/lib/utils/json";
import { upsertDefaultSolverConfig } from "@/lib/api/solverConfigs";

export default function AdminConfigPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { user, profile } = await getMe();
        if (!user) return router.replace("/login");
        if (profile?.role !== "admin") return router.replace("/plan");
      } catch (e: any) {
        setMsg("Fehler beim Laden/Authentifizieren.");
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const onUpload = async (f: File) => {
    setMsg(null);
    setFileName(f.name);
    setUploading(true);

    try {
      const text = await f.text();
      const parsed = parseJson(text);
      if (!parsed.ok) {
        setMsg(parsed.error);
        return;
      }

      const { error } = await upsertDefaultSolverConfig(parsed.value);
      if (error) {
        setMsg("Fehler: " + error.message);
        return;
      }

      setMsg("Config gespeichert ✅ (name=default)");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <main className="p-6">Lade…</main>;

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Admin – Config Import</h1>
      <p className="text-sm text-gray-600">
        Lädt deine Solver-Config JSON hoch und speichert sie in Supabase.
      </p>

      <input
        type="file"
        accept="application/json"
        disabled={uploading}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
        }}
      />

      {fileName && <div className="text-sm">Datei: {fileName}</div>}
      {msg && <div className="text-sm">{msg}</div>}
    </main>
  );
}
