"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { logoutUser } from "@/lib/api/auth";

export default function LogoutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        await logoutUser();
      } catch (err) {
        console.error("Logout Fehler:", err);
      }

      if (!alive) return;

      router.replace("/login");
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  return <main className="p-6">Logout…</main>;
}
