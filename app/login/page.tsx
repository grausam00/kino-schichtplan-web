"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    router.push("/plan");
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onLogin} className="w-full max-w-sm border rounded p-6 space-y-4">
        <h1 className="text-xl font-bold">Login</h1>

        <div className="space-y-1">
          <label className="text-sm">E-Mail</label>
          <input
            className="w-full border rounded px-3 py-2"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm">Passwort</label>
          <input
            className="w-full border rounded px-3 py-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {msg && <p className="text-red-600 text-sm">{msg}</p>}

        <button
          className="w-full bg-black text-white rounded py-2 disabled:opacity-60"
          disabled={loading}
          type="submit"
        >
          {loading ? "…" : "Einloggen"}
        </button>
      </form>
    </main>
  );
}
