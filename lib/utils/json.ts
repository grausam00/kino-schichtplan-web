export function parseJson(text: string): 
  | { ok: true; value: any }
  | { ok: false; error: string } {

  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, error: "Fehler: Datei ist kein gültiges JSON." };
  }
}
