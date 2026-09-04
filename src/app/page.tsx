import Link from "next/link";
import { getDashboardStats, getRecentActivity } from "@/lib/services/stats";
import { listSearchJobs } from "@/lib/services/jobs";
import { listLeads } from "@/lib/services/leads";
import { StatTile, TemperatureBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, jobs, hotLeads, activity] = await Promise.all([
    getDashboardStats(),
    listSearchJobs(5),
    listLeads({ temperature: "HOT", sort: "newest", limit: 5 }),
    getRecentActivity(12),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-[var(--text-muted)]">Discovery → Qualification → Arab-48 classification → Scoring → CRM</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <StatTile label="Total Leads" value={stats.totalLeads} />
        <StatTile label="Hot" value={stats.hot} accent="#ef4444" />
        <StatTile label="Warm" value={stats.warm} accent="#f59e0b" />
        <StatTile label="Qualified" value={stats.qualified} accent="#3b82f6" />
        <StatTile label="Contacted" value={stats.contacted} />
        <StatTile label="Interested" value={stats.interested} />
        <StatTile label="Converted" value={stats.converted} accent="var(--gold)" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent Search Jobs</h2>
            <Link href="/search-jobs" className="text-xs text-[var(--gold)]">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {jobs.length === 0 && <EmptyHint text="No search jobs yet." href="/search-jobs/new" cta="Start a search" />}
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={`/search-jobs/${job.id}`}
                className="block rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-3 hover:border-[var(--gold)]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{job.name}</span>
                  <span className="text-xs text-[var(--text-muted)]">{job.status}</span>
                </div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">
                  {job.progress_percent}% complete · {job.total_discovered} discovered · {job.total_processed} processed ·{" "}
                  {job.total_qualified} qualified
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent Hot Leads</h2>
            <Link href="/leads?temperature=HOT" className="text-xs text-[var(--gold)]">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {hotLeads.length === 0 && <EmptyHint text="No hot leads yet." />}
            {hotLeads.map((lead) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-3 hover:border-[var(--gold)]"
              >
                <div>
                  <div className="text-sm font-medium">{lead.person_name ?? lead.clinic_name ?? lead.username}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {lead.city ?? "—"} · {lead.target_market} · score {lead.lead_score}
                  </div>
                </div>
                <TemperatureBadge temperature={lead.lead_temperature} />
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Recent Activity</h2>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] divide-y divide-[var(--border)]">
          {activity.length === 0 && <div className="p-3 text-sm text-[var(--text-muted)]">No activity yet.</div>}
          {activity.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-3 py-2 text-xs">
              <span className="text-[var(--text)]">{a.action.replace(/_/g, " ")}</span>
              <span className="text-[var(--text-muted)]">{new Date(a.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function EmptyHint({ text, href, cta }: { text: string; href?: string; cta?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] p-4 text-sm text-[var(--text-muted)]">
      {text}{" "}
      {href && (
        <Link href={href} className="text-[var(--gold)]">
          {cta}
        </Link>
      )}
    </div>
  );
}
