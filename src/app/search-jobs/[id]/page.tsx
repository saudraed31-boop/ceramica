import { notFound } from "next/navigation";
import { getSearchJob } from "@/lib/services/jobs";
import { query } from "@/lib/db";
import { cancelJobAction, pauseJobAction, resumeJobAction, retryFromCheckpointAction } from "@/app/actions";

export const dynamic = "force-dynamic";

interface ActivityRow {
  id: string;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getSearchJob(id);
  if (!job) notFound();

  const activity = await query<ActivityRow>(
    `select id, action, metadata, created_at from activity_log where job_id = $1 order by created_at desc limit 100`,
    [id],
  );

  const boundPause = pauseJobAction.bind(null, id);
  const boundResume = resumeJobAction.bind(null, id);
  const boundCancel = cancelJobAction.bind(null, id);
  const boundRetry = retryFromCheckpointAction.bind(null, id);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{job.name}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <StatusPill status={job.status} />
            <span>· stage: {job.stage}</span>
            <span>· provider: {job.provider}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {job.status === "running" && (
            <form action={boundPause}>
              <ActionButton>Pause</ActionButton>
            </form>
          )}
          {(job.status === "paused" || job.status === "failed") && (
            <form action={boundResume}>
              <ActionButton>Resume</ActionButton>
            </form>
          )}
          {job.status === "failed" && (
            <form action={boundRetry}>
              <ActionButton primary>Retry from last checkpoint</ActionButton>
            </form>
          )}
          {job.status !== "completed" && job.status !== "cancelled" && (
            <form action={boundCancel}>
              <ActionButton danger>Cancel</ActionButton>
            </form>
          )}
        </div>
      </div>

      {job.error_message && (
        <div className="rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          <strong>Error:</strong> {job.error_message}
        </div>
      )}

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span>Progress</span>
          <span>{job.progress_percent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--ink-soft)]">
          <div className="h-full rounded-full bg-[var(--gold)]" style={{ width: `${job.progress_percent}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Discovered" value={job.total_discovered} />
        <Metric label="Processed" value={job.total_processed} />
        <Metric label="Qualified / Leads" value={job.total_qualified} />
        <Metric label="Failed" value={job.total_failed} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Search Parameters</h2>
        <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-3 text-xs text-[var(--text-muted)]">
          {JSON.stringify(job.parameters, null, 2)}
        </pre>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Live Activity Feed</h2>
        <div className="max-h-96 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] divide-y divide-[var(--border)]">
          {activity.length === 0 && <div className="p-3 text-sm text-[var(--text-muted)]">No activity yet.</div>}
          {activity.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-3 py-2 text-xs">
              <span>
                {a.action.replace(/_/g, " ")}
                {a.metadata && Object.keys(a.metadata).length > 0 && (
                  <span className="ml-2 text-[var(--text-muted)]">{JSON.stringify(a.metadata)}</span>
                )}
              </span>
              <span className="shrink-0 pl-3 text-[var(--text-muted)]">
                {new Date(a.created_at).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-3">
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    queued: "#6b7280",
    running: "#3b82f6",
    paused: "#f59e0b",
    completed: "#22c55e",
    failed: "#ef4444",
    cancelled: "#6b7280",
  };
  const color = colors[status] ?? "#6b7280";
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${color}22`, color }}>
      {status}
    </span>
  );
}

function ActionButton({
  children,
  primary,
  danger,
}: {
  children: React.ReactNode;
  primary?: boolean;
  danger?: boolean;
}) {
  const base = "rounded-md px-3 py-1.5 text-sm font-medium";
  const style = danger
    ? "border border-red-900 text-red-400 hover:bg-red-950/40"
    : primary
      ? "bg-[var(--gold)] text-black hover:bg-[var(--gold-dark)] hover:text-white"
      : "border border-[var(--border)] hover:bg-[var(--ink-soft)]";
  return <button className={`${base} ${style}`}>{children}</button>;
}
