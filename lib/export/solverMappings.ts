export const WD: Record<number, string> = { 1: "Mo", 2: "Di", 3: "Mi", 4: "Do", 5: "Fr", 6: "Sa", 7: "So" };

export function slotToSolver(slot: string) {
  // '14:00' -> '14'
  return slot.replace(":00", "");
}
