import { notFound } from "next/navigation";
import { getLead } from "@/lib/services/leads";
import { query, queryOne } from "@/lib/db";
import { TemperatureBadge, ConfidenceBar, StatusBadge } from "@/components/ui";
import type { QualificationResult, ScoreBreakdown } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();

  const [scoreRow, qualificationRow, activity] = await Promise.all([
    queryOne<{ total_score: number; score_breakdown: ScoreBreakdown; scoring_version: string }>(
      `select total_score, score_breakdown, scoring_version from lead_scores where lead_id = $1 order by created_at desc limit 1`,
      [id],
    ),
    queryOne<{ result: QualificationResult }>(
      `select result from qualification_results where social_account_id = $1 order by created_at desc limit 1`,
      [lead.social_account_id],
    ),
    query<{ id: string; action: string; created_at: string }>(
      `select id, action, created_at from activity_log where lead_id = $1 order by created_at desc limit 50`,
      [id],
    ),
  ]);

  const qualification = qualificationRow?.result;
  const breakdown = scoreRow?.score_breakdown;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{lead.person_name ?? lead.clinic_name ?? lead.username}</h1>
          <div className="text-sm text-[var(--text-muted)]">@{lead.username}</div>
        </div>
        <div className="flex items-center gap-2">
          <TemperatureBadge temperature={lead.lead_temperature} />
          <StatusBadge status={lead.sales_status} />
        </div>
      </div>

      <Section title="Profile">
        <Grid>
          <Field label="Instagram">
            {lead.profile_url ? (
              <a href={lead.profile_url} target="_blank" rel="noreferrer" className="text-[var(--gold)]">
                {lead.profile_url}
              </a>
            ) : (
              "—"
            )}
          </Field>
          <Field label="Clinic">{lead.clinic_name ?? "—"}</Field>
          <Field label="Country">{lead.country ?? "—"}</Field>
          <Field label="City">{lead.city ?? "—"}</Field>
          <Field label="Specialty">{(lead.specialty ?? "—").replace(/_/g, " ")}</Field>
          <Field label="Followers">{lead.followers_count?.toLocaleString() ?? "—"}</Field>
          <Field label="Website">{lead.website ?? "—"}</Field>
          <Field label="Email">{lead.email ?? "—"}</Field>
          <Field label="Phone">{lead.phone ?? "—"}</Field>
        </Grid>
        {lead.bio && <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--text-muted)]">{lead.bio}</p>}
      </Section>

      <Section title="Market">
        <Grid>
          <Field label="Target Market">{lead.target_market}</Field>
          <Field label="Arab-48 / Market Confidence">
            <ConfidenceBar value={Number(lead.market_confidence)} />
          </Field>
        </Grid>
        <div className="mt-3">
          <div className="mb-1 text-xs uppercase tracking-wide text-[var(--text-muted)]">Classification Signals</div>
          <div className="flex flex-wrap gap-1">
            {(lead.market_signals ?? []).map((s: string) => (
              <span key={s} className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs">
                {s}
              </span>
            ))}
            {(lead.market_signals ?? []).length === 0 && (
              <span className="text-xs text-[var(--text-muted)]">No signals recorded.</span>
            )}
          </div>
        </div>
      </Section>

      <Section title="Qualification">
        <Grid>
          <Field label="Lead Score">{lead.lead_score}</Field>
          <Field label="Temperature">
            <TemperatureBadge temperature={lead.lead_temperature} />
          </Field>
          <Field label="Qualification Status">{lead.qualification_status.replace(/_/g, " ")}</Field>
        </Grid>
        {breakdown && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
            {Object.entries(breakdown).map(([key, value]) => (
              <div key={key} className="rounded-md border border-[var(--border)] p-2">
                <div className="text-[var(--text-muted)]">{key}</div>
                <div className="font-medium">{value as number}</div>
              </div>
            ))}
          </div>
        )}
        {qualification && (
          <div className="mt-3 space-y-2 text-sm">
            <p>{qualification.qualification_reason}</p>
            {qualification.relevant_services.length > 0 && (
              <p className="text-[var(--text-muted)]">
                Relevant services: {qualification.relevant_services.join(", ").replace(/_/g, " ")}
              </p>
            )}
            {qualification.red_flags.length > 0 && (
              <p className="text-amber-400">Red flags: {qualification.red_flags.join(", ").replace(/_/g, " ")}</p>
            )}
          </div>
        )}
      </Section>

      <Section title="Activity">
        <div className="divide-y divide-[var(--border)]">
          {activity.length === 0 && <div className="py-2 text-sm text-[var(--text-muted)]">No activity yet.</div>}
          {activity.map((a) => (
            <div key={a.id} className="flex items-center justify-between py-2 text-sm">
              <span>{a.action.replace(/_/g, " ")}</span>
              <span className="text-xs text-[var(--text-muted)]">{new Date(a.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Notes">
        <p className="text-sm text-[var(--text-muted)]">{lead.notes ?? "No notes yet."}</p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
