import Link from "next/link";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-60 border-r bg-white p-4 space-y-4">
        <div className="font-bold text-lg">Kino Schichtplan</div>

        <nav className="space-y-1 text-sm">
          <Link className="block px-3 py-2 rounded hover:bg-gray-50" href="/plan">
            Plan
          </Link>
          <Link className="block px-3 py-2 rounded hover:bg-gray-50" href="/staffing">
            Staffing
          </Link>
          <Link className="block px-3 py-2 rounded hover:bg-gray-50" href="/solver">
            Solver
          </Link>
          <Link className="block px-3 py-2 rounded hover:bg-gray-50" href="/rules">
            Regeln
          </Link>
        </nav>

        <div className="pt-2 border-t text-xs text-gray-500">
          Tipp: Admin kann in Plan per Klick Max. Personen ändern.
        </div>
      </aside>

      <div className="flex-1 bg-gray-50">
        {children}
      </div>
    </div>
  );
}
