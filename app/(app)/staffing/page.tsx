"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe } from "@/lib/auth/getMe";
import type { StaffingProfile, SchoolHoliday } from "@/lib/types/staffing";

import { loadStaffingData, saveStaffingProfile, syncFutureShiftsFromProfiles, addHoliday, deleteHoliday } from "@/lib/api/staffing";
import {
  DAYS_OF_WEEK,
  SLOTS,
  validateProfile,
  getDefaultProfile,
  formatDate,
  getDaysDuration,
} from "@/lib/rules/staffing";

const DAY_LABELS: Record<string, string> = {
  wednesday: "Mittwoch",
  thursday: "Donnerstag",
  friday: "Freitag",
  saturday: "Samstag",
  sunday: "Sonntag",
};

export default function AdminStaffingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [normalProfile, setNormalProfile] = useState<StaffingProfile | null>(null);
  const [holidayProfile, setHolidayProfile] = useState<StaffingProfile | null>(null);
  const [holidays, setHolidays] = useState<SchoolHoliday[]>([]);

  const [activeTab, setActiveTab] = useState<"normal" | "holidays">("normal");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function reload() {
    const data = await loadStaffingData();
    setNormalProfile(data.normalProfile ?? getDefaultProfile());
    setHolidayProfile(data.holidayProfile ?? getDefaultProfile());
    setHolidays(data.holidays ?? []);
  }

  useEffect(() => {
    (async () => {
      try {
        const { user, profile } = await getMe();
        if (!user) return router.replace("/login");
        if (profile?.role !== "admin") return router.replace("/plan");

        await reload();
      } catch (e: any) {
        setError(e?.message ?? "Fehler beim Laden der Daten");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  function handleProfileChange(day: string, slot: string, value: string) {
    const num = Math.max(0, parseInt(value) || 0);
    const profile = activeTab === "normal" ? normalProfile : holidayProfile;
    if (!profile) return;

    const updated = {
      ...profile,
      [day]: {
        ...(profile as any)[day],
        [slot]: num,
      },
    } as StaffingProfile;

    if (activeTab === "normal") setNormalProfile(updated);
    else setHolidayProfile(updated);
  }

  async function handleSaveProfile() {
    const prof = activeTab === "normal" ? normalProfile : holidayProfile;
    if (!prof) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (!validateProfile(prof)) {
        setError("Ungültige Werte: Nur Zahlen ≥ 0 erlaubt");
        return;
      }

      const { user, profile } = await getMe();
      if (!user || !profile) throw new Error("Authentifizierung erforderlich");

      const key = activeTab === "normal" ? "pflichtbesetzung_normal" : "pflichtbesetzung_ferien";

      await saveStaffingProfile({ key, value: prof, updatedBy: user.id });

      // Sync: min aus Profil, max nur wenn Default (Variante 2)
      if (!normalProfile || !holidayProfile) throw new Error("Profile nicht geladen");
      const res = await syncFutureShiftsFromProfiles({
        normalProfile,
        holidayProfile,
        holidays,
      });

      setSuccess(
        `Profil "${activeTab === "normal" ? "Normal" : "Ferien"}" gespeichert ✅ (Shifts synchronisiert: ${res.updated})`
      );
      await reload();
    } catch (e: any) {
      setError(e?.message ?? "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddHoliday(name: string, startDate: string, endDate: string) {
    if (!name || !startDate || !endDate) return setError("Alle Felder ausfüllen");
    if (endDate < startDate) return setError("Enddatum muss nach Startdatum liegen");

    setError(null);
    setSuccess(null);

    try {
      await addHoliday(name, startDate, endDate);
      setSuccess("Ferien hinzugefügt ✅");
      await reload();
    } catch (e: any) {
      setError(e?.message ?? "Fehler beim Hinzufügen");
    }
  }

  async function handleDeleteHoliday(id: number) {
    if (!confirm("Wirklich löschen?")) return;

    setError(null);
    setSuccess(null);

    try {
      await deleteHoliday(id);
      setSuccess("Ferien gelöscht ✅");
      await reload();
    } catch (e: any) {
      setError(e?.message ?? "Fehler beim Löschen");
    }
  }

  if (loading) return <main className="p-6">Lade…</main>;

  const profile = activeTab === "normal" ? normalProfile : holidayProfile;

  return (
    <main className="p-6 space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Pflichtbesetzung verwalten</h1>
        <p className="text-sm text-gray-600">Konfiguriere die globalen Standardprofile für Schichterstellung</p>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}
      {success && <div className="p-4 bg-green-50 border border-green-200 rounded text-green-700 text-sm">{success}</div>}

      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("normal")}
          className={`px-4 py-2 font-medium transition ${
            activeTab === "normal" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Normalprofil (außerhalb Ferien)
        </button>
        <button
          onClick={() => setActiveTab("holidays")}
          className={`px-4 py-2 font-medium transition ${
            activeTab === "holidays" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Ferienprofil
        </button>
      </div>

      {profile && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-2 text-left font-semibold text-gray-700">Wochentag</th>
                {SLOTS.map((slot) => (
                  <th key={slot} className="px-4 py-2 text-center font-semibold text-gray-700">
                    {slot}:00 Uhr
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS_OF_WEEK.map((day) => (
                <tr key={day} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{DAY_LABELS[day]}</td>
                  {SLOTS.map((slot) => (
                    <td key={`${day}-${slot}`} className="px-4 py-3 text-center">
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={(profile as any)[day]?.[slot] ?? 0}
                        onChange={(e) => handleProfileChange(day, slot, e.target.value)}
                        className="w-16 px-2 py-1 border rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        onClick={handleSaveProfile}
        disabled={saving}
        className="px-6 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition disabled:opacity-50"
      >
        {saving ? "Speichere…" : "Profil speichern"}
      </button>

      <div className="border-t pt-8 space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Schulferien BW verwalten</h2>
          <p className="text-sm text-gray-600">Definiere Datumsbereich für Ferienprofile</p>
        </div>

        <HolidaySection holidays={holidays} onAdd={handleAddHoliday} onDelete={handleDeleteHoliday} />
      </div>
    </main>
  );
}

function HolidaySection({
  holidays,
  onAdd,
  onDelete,
}: {
  holidays: SchoolHoliday[];
  onAdd: (name: string, startDate: string, endDate: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAdd() {
    setLoading(true);
    await onAdd(name, startDate, endDate);
    setName("");
    setStartDate("");
    setEndDate("");
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="border rounded p-4 bg-gray-50 space-y-3">
        <h3 className="font-semibold text-gray-900">Neue Ferien hinzufügen</h3>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-2">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              placeholder="z.B. Osterferien"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Von</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Bis</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700 transition disabled:opacity-50"
          >
            {loading ? "…" : "Hinzufügen"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">Aktuelle Ferien ({holidays.length})</h3>

        {holidays.length === 0 ? (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded text-gray-600 text-sm">
            Keine Ferien definiert. Füge welche hinzu, um automatisch auf das Ferienprofil zu wechseln.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {holidays.map((holiday) => (
              <div key={holiday.id} className="p-4 border rounded bg-white hover:bg-gray-50 transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-1">
                    <div className="font-semibold text-gray-900">{holiday.name}</div>
                    <div className="text-sm text-gray-600">
                      {formatDate(holiday.start_date)} – {formatDate(holiday.end_date)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {getDaysDuration(holiday.start_date, holiday.end_date)} Tage
                    </div>
                  </div>
                  <button
                    onClick={() => onDelete(holiday.id)}
                    className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition whitespace-nowrap"
                  >
                    Löschen
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
