"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUserAndProfile, loginWithOAuth, loginWithPassword } from "@/lib/api/auth";
import { redirectAfterLogin } from "@/lib/rules/authRedirect";

export default function LoginPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Wenn schon eingeloggt -> direkt weiter
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { user, profile } = await getCurrentUserAndProfile();
        if (!alive) return;

        if (user) {
          router.replace(redirectAfterLogin(profile ?? null));
          return;
        }

        setChecking(false);
      } catch {
        // Wenn getMe intern failt, lassen wir Login zu (besser UX)
        if (!alive) return;
        setChecking(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const res = await loginWithPassword(email.trim(), password);
      router.replace(res.redirectTo);
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Login fehlgeschlagen.");
      setSubmitting(false);
    }
  }

  async function onOAuth(provider: "google" | "github") {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const { url } = await loginWithOAuth(provider);
      window.location.href = url; // redirect
    } catch (err: any) {
      setErrorMsg(err?.message ?? "OAuth Login fehlgeschlagen.");
      setSubmitting(false);
    }
  }

  if (checking) return <main className="p-6">Lade…</main>;

  return (
    <main className="p-6 max-w-md">
      <h1 className="text-2xl font-bold mb-4">Login</h1>

      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1">
          <label className="text-sm">E-Mail</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            type="email"
            required
            disabled={submitting}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm">Passwort</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            type="password"
            required
            disabled={submitting}
          />
        </div>

        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

        <button
          className="w-full rounded px-3 py-2 border"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Login…" : "Einloggen"}
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded px-3 py-2 border"
            disabled={submitting}
            onClick={() => onOAuth("google")}
          >
            Google
          </button>
          <button
            type="button"
            className="flex-1 rounded px-3 py-2 border"
            disabled={submitting}
            onClick={() => onOAuth("github")}
          >
            GitHub
          </button>
        </div>
      </form>
    </main>
  );
}
