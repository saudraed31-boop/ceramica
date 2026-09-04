import { query, queryOne } from "@/lib/db";
import type { JobStage, JobStatus, SearchJobParameters, SearchJobRow } from "@/lib/types";

export async function createSearchJob(params: {
  userId?: string | null;
  name: string;
  provider: string;
  parameters: SearchJobParameters;
}): Promise<SearchJobRow> {
  const row = await queryOne<SearchJobRow>(
    `insert into search_jobs (user_id, name, provider, parameters, status, stage)
     values ($1, $2, $3, $4, 'queued', 'initializing')
     returning *`,
    [params.userId ?? null, params.name, params.provider, JSON.stringify(params.parameters)],
  );
  if (!row) throw new Error("createSearchJob: insert returned no row");
  return row;
}

export async function getSearchJob(id: string): Promise<SearchJobRow | null> {
  return queryOne<SearchJobRow>(`select * from search_jobs where id = $1`, [id]);
}

export async function listSearchJobs(limit = 50): Promise<SearchJobRow[]> {
  return query<SearchJobRow>(`select * from search_jobs order by created_at desc limit $1`, [limit]);
}

// Atomically claims the oldest queued job so multiple worker instances never
// process the same job twice.
export async function claimNextQueuedJob(): Promise<SearchJobRow | null> {
  return queryOne<SearchJobRow>(
    `update search_jobs
     set status = 'running', started_at = coalesce(started_at, now()), last_heartbeat = now(), updated_at = now()
     where id = (
       select id from search_jobs
       where status = 'queued'
       order by created_at asc
       limit 1
       for update skip locked
     )
     returning *`,
  );
}

export async function getJobStatus(id: string): Promise<JobStatus | null> {
  const row = await queryOne<{ status: JobStatus }>(`select status from search_jobs where id = $1`, [id]);
  return row?.status ?? null;
}

export async function setJobStatus(
  id: string,
  status: JobStatus,
  extra: { errorMessage?: string | null; completedAt?: boolean } = {},
): Promise<void> {
  await query(
    `update search_jobs
     set status = $2,
         error_message = coalesce($3, error_message),
         completed_at = case when $4 then now() else completed_at end,
         updated_at = now()
     where id = $1`,
    [id, status, extra.errorMessage ?? null, Boolean(extra.completedAt)],
  );
}

export async function updateJobProgress(
  id: string,
  fields: Partial<{
    stage: JobStage;
    cursor: string | null;
    progressPercent: number;
    totalDiscovered: number;
    totalProcessed: number;
    totalQualified: number;
    totalFailed: number;
    retryCount: number;
  }>,
): Promise<void> {
  const sets: string[] = ["updated_at = now()", "last_heartbeat = now()"];
  const values: unknown[] = [id];
  let i = 2;

  const map: Record<string, unknown> = {
    stage: fields.stage,
    cursor: fields.cursor,
    progress_percent: fields.progressPercent,
    total_discovered: fields.totalDiscovered,
    total_processed: fields.totalProcessed,
    total_qualified: fields.totalQualified,
    total_failed: fields.totalFailed,
    retry_count: fields.retryCount,
  };

  for (const [column, value] of Object.entries(map)) {
    if (value !== undefined) {
      sets.push(`${column} = $${i}`);
      values.push(value);
      i++;
    }
  }

  if (sets.length === 2) return; // nothing to update besides heartbeat/updated_at
  await query(`update search_jobs set ${sets.join(", ")} where id = $1`, values);
}

export async function touchHeartbeat(id: string): Promise<void> {
  await query(`update search_jobs set last_heartbeat = now() where id = $1`, [id]);
}

export async function logActivity(params: {
  userId?: string | null;
  leadId?: string | null;
  jobId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await query(
    `insert into activity_log (user_id, lead_id, job_id, action, metadata)
     values ($1, $2, $3, $4, $5)`,
    [
      params.userId ?? null,
      params.leadId ?? null,
      params.jobId ?? null,
      params.action,
      JSON.stringify(params.metadata ?? {}),
    ],
  );
}
