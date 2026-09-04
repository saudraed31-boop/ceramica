import Link from "next/link";
import { listLeads } from "@/lib/services/leads";
import { TemperatureBadge, ConfidenceBar, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const MARKETS = ["ARAB_48", "ISRAELI_OTHER", "PALESTINIAN_TERRITORIES", "GULF", "JORDAN", "IRAQ", "OTHER", "UNKNOWN"];
const TEMPERATURES = ["HOT", "WARM", "QUALIFIED", "LOW", "DISQUALIFIED"];

interface SearchParams {
  targetMarket?: string;
  temperature?: string;
  minScore?: string;
  city?: string;
  sort?: string;
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;

  const leads = await listLeads({
    targetMarket: sp.targetMarket || undefined,
    temperature: sp.temperature || undefined,
    minScore: sp.minScore ? Number(sp.minScore) : undefined,
    city: sp.city || undefined,
    sort: sp.sort === "newest" ? "newest" : "score",
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Leads</h1>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-3">
        <FilterSelect name="targetMarket" label="Target Market" options={MARKETS} value={sp.targetMarket} />
        <FilterSelect name="temperature" label="Temperature" options={TEMPERATURES} value={sp.temperature} />
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--text-muted)]">City</span>
          <input
            name="city"
            defaultValue={sp.city}
            className="rounded-md border border-[var(--border)] bg-[var(--ink)] px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--text-muted)]">Min score</span>
          <input
            type="number"
            name="minScore"
            defaultValue={sp.minScore}
            className="w-24 rounded-md border border-[var(--border)] bg-[var(--ink)] px-2 py-1.5 text-sm"
          />
        </label>
        <FilterSelect name="sort" label="Sort" options={["score", "newest"]} value={sp.sort} />
        <button className="rounded-md bg-[var(--gold)] px-3 py-1.5 text-sm font-medium text-black">Apply</button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--bg-panel)] text-xs uppercase text-[var(--text-muted)]">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Instagram</th>
              <th className="px-3 py-2">City</th>
              <th className="px-3 py-2">Specialty</th>
              <th className="px-3 py-2">Followers</th>
              <th className="px-3 py-2">Target Market</th>
              <th className="px-3 py-2">Confidence</th>
              <th className="px-3 py-2">Score</th>
              <th className="px-3 py-2">Temp</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-[var(--ink-soft)]">
                <td className="px-3 py-2">
                  <Link href={`/leads/${lead.id}`} className="text-[var(--gold)]">
                    {lead.person_name ?? lead.clinic_name ?? lead.username}
                  </Link>
                </td>
                <td className="px-3 py-2 text-[var(--text-muted)]">@{lead.username}</td>
                <td className="px-3 py-2">{lead.city ?? "—"}</td>
                <td className="px-3 py-2">{(lead.specialty ?? "—").replace(/_/g, " ")}</td>
                <td className="px-3 py-2">{lead.followers_count?.toLocaleString() ?? "—"}</td>
                <td className="px-3 py-2">{lead.target_market}</td>
                <td className="px-3 py-2">
                  <ConfidenceBar value={Number(lead.market_confidence)} />
                </td>
                <td className="px-3 py-2 font-medium">{lead.lead_score}</td>
                <td className="px-3 py-2">
                  <TemperatureBadge temperature={lead.lead_temperature} />
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={lead.sales_status} />
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-[var(--text-muted)]">
                  No leads match these filters yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterSelect({
  name,
  label,
  options,
  value,
}: {
  name: string;
  label: string;
  options: string[];
  value?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
      <select
        name={name}
        defaultValue={value ?? ""}
        className="rounded-md border border-[var(--border)] bg-[var(--ink)] px-2 py-1.5 text-sm"
      >
        <option value="">All</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}
