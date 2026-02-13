// lib/rules/unavailabilityRules.ts

export type TimeSlot = "14:00" | "17:00" | "20:00";
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

export type UnavailabilityRuleRow = {
  id: number;
  user_id: string;
  weekday: number; // 1..7
  time_slot: TimeSlot | null; // null = ALLDAY
  comment: string | null;
  created_at: string;
};

export type CreateUnavailabilityRuleInput = {
  user_id: string;
  weekday: number;
  time_slot: TimeSlot | null; // null = ALLDAY
  comment: string | null;
};

export function normalizeComment(raw: string): string | null {
  const t = raw.trim();
  return t ? t : null;
}

export function validateWeekday(weekday: number): string | null {
  if (!Number.isFinite(weekday)) return "Ungültiger Wochentag.";
  if (weekday < 1 || weekday > 7) return "Wochentag muss 1..7 sein.";
  return null;
}

export function validateSlot(slot: TimeSlot | null): string | null {
  if (slot === null) return null;
  if (!SLOTS.includes(slot)) return "Ungültiger Slot.";
  return null;
}

export function isDuplicateRule(
  existing: UnavailabilityRuleRow[],
  weekday: number,
  slot: TimeSlot | null
) {
  return existing.some((x) => x.weekday === weekday && x.time_slot === slot);
}

export function ruleLabel(r: Pick<UnavailabilityRuleRow, "weekday" | "time_slot">) {
  const day = WEEKDAYS[r.weekday] ?? `Tag ${r.weekday}`;
  const slot = r.time_slot ? r.time_slot : "Ganztägig";
  return `${day} — ${slot}`;
}

export function buildCreateRulesBulk(args: {
  userId: string;
  weekday: number;
  allDay: boolean;
  slots: TimeSlot[]; // nur relevant wenn !allDay
  commentRaw: string;
  existing: UnavailabilityRuleRow[];
}): { ok: true; value: CreateUnavailabilityRuleInput[] } | { ok: false; error: string } {
  const wdErr = validateWeekday(args.weekday);
  if (wdErr) return { ok: false, error: wdErr };

  const comment = normalizeComment(args.commentRaw);

  if (args.allDay) {
    if (isDuplicateRule(args.existing, args.weekday, null)) {
      return { ok: false, error: "Diese ganztägige Regel existiert bereits." };
    }
    return {
      ok: true,
      value: [{ user_id: args.userId, weekday: args.weekday, time_slot: null, comment }],
    };
  }

  const uniqueSlots = Array.from(new Set(args.slots));
  if (uniqueSlots.length === 0) return { ok: false, error: "Bitte mindestens einen Slot auswählen." };

  const invalid = uniqueSlots.find((s) => !SLOTS.includes(s));
  if (invalid) return { ok: false, error: "Ungültiger Slot gewählt." };

  const hasAllDay = isDuplicateRule(args.existing, args.weekday, null);
  if (hasAllDay) {
    return { ok: false, error: "Für diesen Tag existiert bereits eine ganztägige Regel." };
  }

  const toCreate = uniqueSlots
    .filter((s) => !isDuplicateRule(args.existing, args.weekday, s))
    .map((s) => ({ user_id: args.userId, weekday: args.weekday, time_slot: s, comment }));

  if (toCreate.length === 0) {
    return { ok: false, error: "Alle ausgewählten Slots existieren bereits." };
  }

  return { ok: true, value: toCreate };
}
