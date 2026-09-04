import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const [byMarket, byCity, bySpecialty, byTemperature] = await Promise.all([
    query<{ target_market: string; count: string }>(
      `select target_market, count(*) from leads where qualification_status <> 'not_a_lead' group by target_market order by count(*) desc`,
    ),
    query<{ city: string | null; count: string }>(
      `select city, count(*) from leads where qualification_status <> 'not_a_lead' group by city order by count(*) desc limit 10`,
    ),
    query<{ specialty: string | null; count: string }>(
      `select specialty, count(*) from leads where qualification_status <> 'not_a_lead' group by specialty order by count(*) desc`,
    ),
    query<{ lead_temperature: string; count: string }>(
      `select lead_temperature, count(*) from leads where qualification_status <> 'not_a_lead' group by lead_temperature order by count(*) desc`,
    ),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Analytics</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Early breakdowns from live lead data. Search performance, contact/response/conversion funnels, and
          Arab-48 confidence distribution land in Phase 9.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Breakdown title="Leads by Target Market" rows={byMarket.map((r) => ({ label: r.target_market, count: r.count }))} />
        <Breakdown title="Leads by Temperature" rows={byTemperature.map((r) => ({ label: r.lead_temperature, count: r.count }))} />
        <Breakdown title="Leads by City" rows={byCity.map((r) => ({ label: r.city ?? "Unknown", count: r.count }))} />
        <Breakdown
          title="Leads by Specialty"
          rows={bySpecialty.map((r) => ({ label: (r.specialty ?? "Unknown").replace(/_/g, " "), count: r.count }))}
        />
      </div>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: { label: string; count: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => Number(r.count)));
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <div className="space-y-2">
        {rows.length === 0 && <div className="text-sm text-[var(--text-muted)]">No data yet.</div>}
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2 text-sm">
            <span className="w-32 shrink-0 truncate">{r.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--ink-soft)]">
              <div
                className="h-full rounded-full bg-[var(--gold)]"
                style={{ width: `${(Number(r.count) / max) * 100}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-[var(--text-muted)]">{r.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
