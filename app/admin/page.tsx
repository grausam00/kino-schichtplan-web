"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkAdminAccess } from "@/lib/api/admin";

export default function AdminHome() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      const res = await checkAdminAccess();

      if (!alive) return;

      if (!res.allowed) {
        router.replace(res.redirectTo);
        return;
      }

      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  if (loading) return <main className="p-6">Lade…</main>;

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold">Admin</h1>
      <p>Du bist Admin ✅</p>
    </main>
  );
}
