"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe } from "@/lib/auth/getMe";
import { supabase } from "@/lib/supabase/client";

export default function AdminConfigPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { user, profile } = await getMe();
      if (!user) return router.replace("/login");
      if (profile?.role !== "admin") return router.replace("/plan");
      setLoading(false);
    })();
  }, [router]);

  const onUpload = async (f: File) => {
    setMsg(null);
    setFileName(f.name);

    const text = await f.text();
    let cfg: any;
    try {
      cfg = JSON.parse(text);
    } catch {
      setMsg("Fehler: Datei ist kein gültiges JSON.");
      return;
    }

    const { error } = await supabase
      .from("solver_configs")
      .upsert({ name: "default", config: cfg }, { onConflict: "name" });

    if (error) {
      setMsg("Fehler: " + error.message);
      return;
    }

    setMsg("Config gespeichert ✅ (name=default)");
  };

  if (loading) return <main className="p-6">Lade…</main>;

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Admin – Config Import</h1>
      <p className="text-sm text-gray-600">Lädt deine Solver-Config JSON hoch und speichert sie in Supabase.</p>

      <input
        type="file"
        accept="application/json"
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
