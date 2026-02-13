export const WD_MON = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

export function dateUTC(isoDate: string) {
  return new Date(isoDate + "T00:00:00Z");
}

export function isoUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function weekdayMonFirst(isoDate: string) {
  const d = dateUTC(isoDate);
  const js = d.getUTCDay(); // So=0, Mo=1, ...
  const idx = (js + 6) % 7; // Mo=0 ... So=6
  return WD_MON[idx];
}

export function mondayOfWeek(isoDate: string) {
  const d = dateUTC(isoDate);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return isoUTC(d);
}

export function weekDatesFromMonday(mondayIso: string) {
  const start = dateUTC(mondayIso);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    out.push(isoUTC(d));
  }
  return out; // Mo..So
}

export function formatDE(isoDate: string) {
  const d = new Date(isoDate + "T12:00:00Z"); // stabil
  return d.toLocaleDateString("de-DE");
}
