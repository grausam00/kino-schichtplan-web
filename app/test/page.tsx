"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function TestPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .limit(5);

      if (error) setErrorMsg(error.message);
      else setRows(data ?? []);
    };

    load();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Supabase Test</h1>
      {errorMsg && <p style={{ color: "red" }}>Fehler: {errorMsg}</p>}
      <pre>{JSON.stringify(rows, null, 2)}</pre>
    </div>
  );
}
