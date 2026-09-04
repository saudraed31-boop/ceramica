import { query, queryOne } from "@/lib/db";
import type { JobStage } from "@/lib/types";

export interface JobCheckpointRow {
  id: string;
  search_job_id: string;
  stage: JobStage;
  cursor: string | null;
  batch_number: number;
  items_processed: number;
  status: "completed" | "failed" | "in_progress";
  created_at: string;
}

export async function recordCheckpoint(params: {
  jobId: string;
  stage: JobStage;
  cursor: string | null;
  batchNumber: number;
  itemsProcessed: number;
  status: "completed" | "failed" | "in_progress";
}): Promise<JobCheckpointRow> {
  const row = await queryOne<JobCheckpointRow>(
    `insert into job_checkpoints (search_job_id, stage, cursor, batch_number, items_processed, status)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [params.jobId, params.stage, params.cursor, params.batchNumber, params.itemsProcessed, params.status],
  );
  if (!row) throw new Error("recordCheckpoint: insert returned no row");
  return row;
}

export async function getLatestCheckpoint(jobId: string): Promise<JobCheckpointRow | null> {
  return queryOne<JobCheckpointRow>(
    `select * from job_checkpoints
     where search_job_id = $1 and status = 'completed'
     order by batch_number desc
     limit 1`,
    [jobId],
  );
}

export async function getNextBatchNumber(jobId: string): Promise<number> {
  const rows = await query<{ max: number | null }>(
    `select max(batch_number) as max from job_checkpoints where search_job_id = $1`,
    [jobId],
  );
  return (rows[0]?.max ?? 0) + 1;
}
