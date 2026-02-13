import { useState } from "react";
import { fetchShiftCapacity } from "@/lib/db/shifts";
import { createPendingAssignment, cancelMyAssignment } from "@/lib/db/assignments";

export function useShiftActions(opts: { meId: string | null; onChanged: () => Promise<void> }) {
  const { meId, onChanged } = opts;
  const [msg, setMsg] = useState<string | null>(null);

  const join = async (shiftId: number) => {
    if (!meId) return;

    try {
      setMsg(null);
      const fresh = await fetchShiftCapacity(shiftId);

      const maxP = fresh.max_persons ?? 0;
      const fixedCount = (fresh.assignments ?? []).filter((a: any) => a.status === "fix").length;
      const pendingCount = (fresh.assignments ?? []).filter((a: any) => a.status === "freiwillig").length;

      if (fixedCount + pendingCount >= maxP) {
        setMsg("Schicht ist voll – keine weiteren Anfragen möglich.");
        return;
      }

      await createPendingAssignment(shiftId, meId);
      await onChanged();
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    }
  };

  const cancel = async (shiftId: number) => {
    if (!meId) return;

    try {
      setMsg(null);
      await cancelMyAssignment(shiftId, meId);
      await onChanged();
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    }
  };

  return { msg, setMsg, join, cancel };
}
