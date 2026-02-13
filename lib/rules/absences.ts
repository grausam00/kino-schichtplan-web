// lib/rules/absences.ts

export type AbsenceType = "urlaub" | "krank" | "sonstiges";

export type AbsenceRow = {
  id: number;
  user_id: string;
  type: AbsenceType;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  comment: string | null;
};

export type CreateAbsenceInput = {
  user_id: string;
  type: AbsenceType;
  start_date: string;
  end_date: string;
  comment: string | null;
};

export function normalizeComment(raw: string): string | null {
  const t = raw.trim();
  return t ? t : null;
}

/**
 * Erwartet ISO "YYYY-MM-DD". Lexikographisch vergleichbar.
 */
export function validateAbsenceRange(start: string, end: string): string | null {
  if (!start || !end) return "Bitte Start- und Enddatum wählen.";
  if (end < start) return "Enddatum darf nicht vor dem Startdatum liegen.";
  return null;
}

export function buildCreateAbsenceInput(args: {
  userId: string;
  type: AbsenceType;
  startDate: string;
  endDate: string;
  commentRaw: string;
}): { ok: true; value: CreateAbsenceInput } | { ok: false; error: string } {
  const rangeErr = validateAbsenceRange(args.startDate, args.endDate);
  if (rangeErr) return { ok: false, error: rangeErr };

  return {
    ok: true,
    value: {
      user_id: args.userId,
      type: args.type,
      start_date: args.startDate,
      end_date: args.endDate,
      comment: normalizeComment(args.commentRaw),
    },
  };
}
