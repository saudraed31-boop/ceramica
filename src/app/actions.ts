"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSearchJob } from "@/lib/services/jobs";
import { query } from "@/lib/db";
import type { SearchJobParameters } from "@/lib/types";

function splitList(value: FormDataEntryValue | null): string[] {
  if (!value || typeof value !== "string") return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

// Creates the job row and returns immediately — the browser never waits for
// discovery to run. A separate, persistent worker process (`npm run worker`)
// picks it up from the queue independently.
export async function createSearchJobAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const targetMarket = String(formData.get("targetMarket") ?? "UNKNOWN");
  const specialty = String(formData.get("specialty") ?? "").trim() || undefined;
  const minFollowers = formData.get("minFollowers") ? Number(formData.get("minFollowers")) : undefined;
  const maxFollowers = formData.get("maxFollowers") ? Number(formData.get("maxFollowers")) : undefined;
  const minLeadScore = formData.get("minLeadScore") ? Number(formData.get("minLeadScore")) : undefined;

  const parameters: SearchJobParameters = {
    country,
    cities: splitList(formData.get("cities")),
    targetMarket,
    specialty,
    minFollowers,
    maxFollowers,
    languages: splitList(formData.get("languages")),
    keywords: splitList(formData.get("keywords")),
    minLeadScore,
    discoveryMethods: ["search"],
  };

  const job = await createSearchJob({
    name: name || `${country} — ${targetMarket} — ${specialty ?? "General"}`,
    provider: "mock",
    parameters,
  });

  revalidatePath("/search-jobs");
  redirect(`/search-jobs/${job.id}`);
}

export async function pauseJobAction(jobId: string): Promise<void> {
  await query(`update search_jobs set status = 'paused', updated_at = now() where id = $1 and status = 'running'`, [
    jobId,
  ]);
  revalidatePath(`/search-jobs/${jobId}`);
}

export async function resumeJobAction(jobId: string): Promise<void> {
  await query(
    `update search_jobs set status = 'queued', updated_at = now() where id = $1 and status in ('paused', 'failed')`,
    [jobId],
  );
  revalidatePath(`/search-jobs/${jobId}`);
}

export async function cancelJobAction(jobId: string): Promise<void> {
  await query(
    `update search_jobs set status = 'cancelled', updated_at = now() where id = $1 and status not in ('completed', 'cancelled')`,
    [jobId],
  );
  revalidatePath(`/search-jobs/${jobId}`);
}

export async function retryFromCheckpointAction(jobId: string): Promise<void> {
  await query(`update search_jobs set status = 'queued', updated_at = now() where id = $1 and status = 'failed'`, [
    jobId,
  ]);
  revalidatePath(`/search-jobs/${jobId}`);
}
