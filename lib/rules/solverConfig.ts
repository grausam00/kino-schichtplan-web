// lib/rules/solverConfig.ts
export type TimeSlot = "14:00" | "17:00" | "20:00";

export type SolverAbsence = {
  // entweder user_id ODER user_name
  user_id?: string;
  user_name?: string;

  type: "urlaub" | "krank" | "sonstiges";
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  comment?: string | null;
};

export type SolverWish = {
  user_id?: string;
  user_name?: string;

  weekday: number; // 1..7 (Mo..So)
  time_slot: TimeSlot;
};

export type SolverUnavailability = {
  user_id?: string;
  user_name?: string;

  weekday: number; // 1..7 (Mo..So)
  time_slot?: TimeSlot | null; // null = ALLDAY
  comment?: string | null;
};

export type SolverConfigJSON = {
  // du kannst natürlich später mehr reinschieben (weights, etc.)
  absences?: SolverAbsence[];
  shift_wishes?: SolverWish[];
  unavailability_rules?: SolverUnavailability[];
};

function isISODate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function assert(cond: any, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

export function normalizeSolverConfig(raw: any): SolverConfigJSON {
  const cfg: SolverConfigJSON = {
    absences: Array.isArray(raw?.absences) ? raw.absences : [],
    shift_wishes: Array.isArray(raw?.shift_wishes) ? raw.shift_wishes : [],
    unavailability_rules: Array.isArray(raw?.unavailability_rules) ? raw.unavailability_rules : [],
  };

  // Basic validation (hart, damit DB Constraints nicht knallen)
  for (const a of cfg.absences ?? []) {
    assert(!!(a.user_id || a.user_name), `Absence: user_id oder user_name fehlt`);
    assert(isISODate(a.start_date), `Absence: start_date muss YYYY-MM-DD sein`);
    assert(isISODate(a.end_date), `Absence: end_date muss YYYY-MM-DD sein`);
    assert(a.end_date >= a.start_date, `Absence: end_date < start_date (${a.start_date}..${a.end_date})`);
    assert(["urlaub", "krank", "sonstiges"].includes(a.type), `Absence: type ungültig: ${a.type}`);
  }

  for (const w of cfg.shift_wishes ?? []) {
    assert(!!(w.user_id || w.user_name), `Wish: user_id oder user_name fehlt`);
    assert(w.weekday >= 1 && w.weekday <= 7, `Wish: weekday muss 1..7 sein`);
    assert(["14:00", "17:00", "20:00"].includes(w.time_slot), `Wish: time_slot ungültig: ${w.time_slot}`);
  }

  for (const u of cfg.unavailability_rules ?? []) {
    assert(!!(u.user_id || u.user_name), `Unavailability: user_id oder user_name fehlt`);
    assert(u.weekday >= 1 && u.weekday <= 7, `Unavailability: weekday muss 1..7 sein`);
    if (u.time_slot != null) {
      assert(["14:00", "17:00", "20:00"].includes(u.time_slot), `Unavailability: time_slot ungültig: ${u.time_slot}`);
    }
  }

  return cfg;
}

// Hilfsfunktionen fürs Mapping nach user_id (wenn config user_name nutzt)
export function collectUserKeys(cfg: SolverConfigJSON) {
  const ids = new Set<string>();
  const names = new Set<string>();

  for (const a of cfg.absences ?? []) {
    if (a.user_id) ids.add(a.user_id);
    else if (a.user_name) names.add(a.user_name);
  }
  for (const w of cfg.shift_wishes ?? []) {
    if (w.user_id) ids.add(w.user_id);
    else if (w.user_name) names.add(w.user_name);
  }
  for (const u of cfg.unavailability_rules ?? []) {
    if (u.user_id) ids.add(u.user_id);
    else if (u.user_name) names.add(u.user_name);
  }

  return { userIds: [...ids], userNames: [...names] };
}

export function mapConfigToRows(
  cfg: SolverConfigJSON,
  nameToId: Map<string, string>
) {
  const absencesRows = (cfg.absences ?? []).map((a) => {
    const user_id = a.user_id ?? nameToId.get(a.user_name ?? "");
    assert(!!user_id, `Absence: user nicht gefunden: ${a.user_name ?? a.user_id}`);
    return {
      user_id,
      type: a.type,
      start_date: a.start_date,
      end_date: a.end_date,
      comment: a.comment ?? null,
    };
  });

  const wishesRows = (cfg.shift_wishes ?? []).map((w) => {
    const user_id = w.user_id ?? nameToId.get(w.user_name ?? "");
    assert(!!user_id, `Wish: user nicht gefunden: ${w.user_name ?? w.user_id}`);
    return {
      user_id,
      weekday: w.weekday,
      time_slot: w.time_slot,
    };
  });

  const unavailRows = (cfg.unavailability_rules ?? []).map((u) => {
    const user_id = u.user_id ?? nameToId.get(u.user_name ?? "");
    assert(!!user_id, `Unavailability: user nicht gefunden: ${u.user_name ?? u.user_id}`);
    return {
      user_id,
      weekday: u.weekday,
      time_slot: u.time_slot ?? null,
      comment: u.comment ?? null,
    };
  });

  return { absencesRows, wishesRows, unavailRows };
}
