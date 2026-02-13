import { useCallback, useEffect, useMemo, useState } from "react";
import type { StaffingProfile, SchoolHoliday } from "@/lib/types/staffing";
import { fetchAllShiftDates, fetchShiftsInRange, type ShiftRowDb } from "@/lib/db/shifts";
import { fetchStaffingProfiles } from "@/lib/db/settings";
import { fetchHolidaysBW } from "@/lib/db/holidays";
import { getApplicableProfile, getMinPersonsForShift } from "@/lib/domain/staffing";
import { mondayOfWeek, weekDatesFromMonday, isoUTC } from "@/lib/domain/dates";

export type ShiftRowUi = ShiftRowDb & { min_persons: number; max_persons: number };

export function usePlanWeek() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [allMondays, setAllMondays] = useState<string[]>([]);
  const [shifts, setShifts] = useState<ShiftRowUi[]>([]);

  const [normalProfile, setNormalProfile] = useState<StaffingProfile | null>(null);
  const [holidayProfile, setHolidayProfile] = useState<StaffingProfile | null>(null);
  const [holidays, setHolidays] = useState<SchoolHoliday[]>([]);

  const init = useCallback(async () => {
    try {
      setLoading(true);
      setMsg(null);

      const [profiles, hols, dates] = await Promise.all([
        fetchStaffingProfiles(),
        fetchHolidaysBW(),
        fetchAllShiftDates(),
      ]);

      setNormalProfile(profiles.normal);
      setHolidayProfile(profiles.holiday);
      setHolidays(hols);

      const uniqueDates = Array.from(new Set(dates)).sort();
      const mondays = Array.from(new Set(uniqueDates.map(mondayOfWeek))).sort();
      setAllMondays(mondays);

      setWeekStart(mondayOfWeek(isoUTC(new Date())));
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWeek = useCallback(
    async (mondayIso: string) => {
      if (!normalProfile || !holidayProfile) return;

      try {
        setLoading(true);
        setMsg(null);

        const weekDates = weekDatesFromMonday(mondayIso);
        const startIso = weekDates[0];
        const endIso = weekDates[6];

        const data = await fetchShiftsInRange(startIso, endIso);

        const enriched: ShiftRowUi[] = (data || []).map((shift: any) => {
          const profile = getApplicableProfile(shift.date, normalProfile, holidayProfile, holidays);
          const minP = getMinPersonsForShift(shift.date, shift.time_slot, profile);
          const maxP = shift.max_persons ?? minP;
          return { ...shift, min_persons: minP, max_persons: maxP };
        });

        setShifts(enriched);
      } catch (e: any) {
        setMsg(e?.message ?? String(e));
        setShifts([]);
      } finally {
        setLoading(false);
      }
    },
    [normalProfile, holidayProfile, holidays]
  );

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (weekStart && normalProfile && holidayProfile) loadWeek(weekStart);
  }, [weekStart, normalProfile, holidayProfile, loadWeek]);

  const weekDates = useMemo(() => (weekStart ? weekDatesFromMonday(weekStart) : []), [weekStart]);

  return {
    loading,
    msg,
    weekStart,
    setWeekStart,
    allMondays,
    shifts,
    weekDates,
    reload: () => weekStart && loadWeek(weekStart),
    loadWeek,
  };
}
