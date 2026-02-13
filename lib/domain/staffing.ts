import type { StaffingProfile, SchoolHoliday } from "@/lib/types/staffing";
import { dateUTC } from "./dates";

function dayOfWeekToString(dayIndex: number): string {
  const days = [
    "sunday","monday","tuesday","wednesday","thursday","friday","saturday",
  ];
  return days[dayIndex];
}

export function isIsoDateInHolidays(isoDate: string, holidays: SchoolHoliday[]): boolean {
  return holidays.some(h => isoDate >= h.start_date && isoDate <= h.end_date);
}

export function getApplicableProfile(
  isoDate: string,
  normalProfile: StaffingProfile,
  holidayProfile: StaffingProfile,
  holidays: SchoolHoliday[]
): StaffingProfile {
  return isIsoDateInHolidays(isoDate, holidays) ? holidayProfile : normalProfile;
}

export function getMinPersonsForShift(
  dateStr: string,
  timeSlot: string, // "14:00"
  profile: StaffingProfile
): number {
  const date = dateUTC(dateStr);
  const dayName = dayOfWeekToString(date.getUTCDay());
  const slotKey = timeSlot.split(":")[0]; // "14:00" → "14"
  return profile[dayName]?.[slotKey] ?? 0;
}
