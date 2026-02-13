"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe } from "@/lib/auth/getMe";

export default function AdminHome() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { user, profile } = await getMe();
      if (!user) {
        router.replace("/login");
        return;
      }
      if (profile?.role !== "admin") {
        router.replace("/plan");
        return;
      }
      setLoading(false);
    })();
  }, [router]);

  if (loading) return <main className="p-6">Lade…</main>;

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold">Admin</h1>
      <p>Du bist Admin ✅</p>
    </main>
  );
}
