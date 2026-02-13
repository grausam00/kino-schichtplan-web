// lib/rules/wishes.ts

export type TimeSlot = "14:00" | "17:00" | "20:00";

export type WishRow = {
  id: number;
  user_id: string;
  weekday: number; // 1..7
  time_slot: TimeSlot;
  created_at: string;
};

export const SLOTS: TimeSlot[] = ["14:00", "17:00", "20:00"];
export const WEEKDAYS: Record<number, string> = {
  1: "Mo",
  2: "Di",
  3: "Mi",
  4: "Do",
  5: "Fr",
  6: "Sa",
  7: "So",
};

export type CreateWishInput = {
  user_id: string;
  weekday: number;
  time_slot: TimeSlot;
};

export function validateWeekday(weekday: number): string | null {
  if (!Number.isFinite(weekday)) return "Ungültiger Wochentag.";
  if (weekday < 1 || weekday > 7) return "Wochentag muss zwischen 1 und 7 liegen.";
  return null;
}

export function isDuplicateWish(existing: WishRow[], weekday: number, timeSlot: TimeSlot) {
  return existing.some((w) => w.weekday === weekday && w.time_slot === timeSlot);
}

export function buildCreateWishInput(args: {
  userId: string;
  weekday: number;
  timeSlot: TimeSlot;
  existing: WishRow[];
}): { ok: true; value: CreateWishInput } | { ok: false; error: string } {
  const wdErr = validateWeekday(args.weekday);
  if (wdErr) return { ok: false, error: wdErr };

  if (!SLOTS.includes(args.timeSlot)) {
    return { ok: false, error: "Ungültiger Zeitslot." };
  }

  if (isDuplicateWish(args.existing, args.weekday, args.timeSlot)) {
    return { ok: false, error: "Dieser Wunsch existiert bereits." };
  }

  return {
    ok: true,
    value: {
      user_id: args.userId,
      weekday: args.weekday,
      time_slot: args.timeSlot,
    },
  };
}
