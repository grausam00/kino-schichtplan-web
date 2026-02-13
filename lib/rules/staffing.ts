// lib/rules/staffing.ts
import type { StaffingProfile, SchoolHoliday } from "@/lib/types/staffing";

export const DAYS_OF_WEEK = ["wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export const SLOTS = ["14", "17", "20"] as const;

export function getDefaultProfile(): StaffingProfile {
  return {
    wednesday: { "14": 2, "17": 1, "20": 0 },
    thursday: { "14": 2, "17": 1, "20": 0 },
    friday: { "14": 2, "17": 1, "20": 0 },
    saturday: { "14": 2, "17": 2, "20": 1 },
    sunday: { "14": 2, "17": 2, "20": 1 },
  };
}

export function validateProfile(profile: StaffingProfile): boolean {
  for (const dayValues of Object.values(profile)) {
    for (const count of Object.values(dayValues)) {
      if (typeof count !== "number" || count < 0 || !Number.isInteger(count)) return false;
    }
  }
  return true;
}

// Dates/holidays
export function isoUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}
export function dateUTC(isoDate: string) {
  return new Date(isoDate + "T00:00:00Z");
}

export function isHoliday(dateStr: string, holidays: Pick<SchoolHoliday, "start_date" | "end_date">[]) {
  return holidays.some(h => dateStr >= h.start_date && dateStr <= h.end_date);
}

export function dayKeyFromDate(isoDate: string) {
  const days = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"] as const;
  return days[dateUTC(isoDate).getUTCDay()];
}
export function slotKeyFromTimeSlot(timeSlot: string) {
  return timeSlot.split(":")[0]; // "14:00" -> "14"
}

export function profileValue(profile: StaffingProfile, isoDate: string, timeSlot: string): number {
  const day = dayKeyFromDate(isoDate);
  const slot = slotKeyFromTimeSlot(timeSlot);
  return Number((profile as any)?.[day]?.[slot] ?? 0);
}

// Variante 2: max nur überschreiben wenn "Default"
export function shouldOverwriteMax(oldMax: number | null, oldMin: number | null) {
  if (oldMax == null) return true;
  if (oldMax === 3) return true;
  if (oldMin != null && oldMax === oldMin) return true;
  return false;
}

// UI helper (kann auch in page bleiben, ist aber ok hier)
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00Z");
  return date.toLocaleDateString("de-DE", {
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function getDaysDuration(startDate: string, endDate: string): number {
  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}
