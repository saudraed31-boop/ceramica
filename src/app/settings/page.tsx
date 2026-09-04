import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [keywordGroups, locations] = await Promise.all([
    query<{ id: string; name: string; language: string; category: string; keywords: string[]; active: boolean }>(
      `select id, name, language, category, keywords, active from keyword_groups order by category, name`,
    ),
    query<{ id: string; name: string; country: string; target_market: string; active: boolean }>(
      `select id, name, country, target_market, active from target_locations order by target_market, name`,
    ),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Discovery keyword groups and the target-location database are configurable data, not hard-coded logic.
          Editing them here is planned next — for now they are seeded via <code>npm run seed</code> and read by the
          classification/discovery engines.
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Keyword Groups ({keywordGroups.length})</h2>
        <div className="space-y-2">
          {keywordGroups.map((g) => (
            <div key={g.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{g.name}</span>
                <span className="text-xs text-[var(--text-muted)]">
                  {g.language} · {g.category} · {g.active ? "active" : "inactive"}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {g.keywords.map((k) => (
                  <span key={k} className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Target Locations ({locations.length})</h2>
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--bg-panel)] text-xs uppercase text-[var(--text-muted)]">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Country</th>
                <th className="px-3 py-2">Target Market</th>
                <th className="px-3 py-2">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {locations.map((loc) => (
                <tr key={loc.id}>
                  <td className="px-3 py-2">{loc.name}</td>
                  <td className="px-3 py-2">{loc.country}</td>
                  <td className="px-3 py-2">{loc.target_market}</td>
                  <td className="px-3 py-2">{loc.active ? "yes" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
