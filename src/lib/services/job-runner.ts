import { query } from "@/lib/db";
import { MockDiscoveryProvider } from "@/lib/providers/mock-provider";
import type { DiscoveryPage, LeadDiscoveryProvider } from "@/lib/providers/types";
import { getLatestCheckpoint, getNextBatchNumber, recordCheckpoint } from "@/lib/services/checkpoints";
import { upsertSocialAccount } from "@/lib/services/dedup";
import { getJobStatus, getSearchJob, logActivity, updateJobProgress } from "@/lib/services/jobs";
import { upsertLead } from "@/lib/services/leads";
import { classifyMarket } from "@/lib/services/classification";
import { defaultQualificationService } from "@/lib/services/qualification";
import { qualifyWithCache } from "@/lib/services/qualification-cache";
import { scoreLead } from "@/lib/services/scoring";
import type { NormalizedAccount, SearchJobRow } from "@/lib/types";

const MAX_PAGE_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 150;

export function getProvider(name: string): LeadDiscoveryProvider {
  switch (name) {
    case "mock":
    default:
      return new MockDiscoveryProvider();
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPageWithRetry(
  provider: LeadDiscoveryProvider,
  jobId: string,
  params: SearchJobRow["parameters"],
  cursor: string | null,
): Promise<DiscoveryPage> {
  let attempt = 0;
  let lastError: unknown;
  while (attempt < MAX_PAGE_RETRIES) {
    try {
      return cursor ? await provider.getNextPage(cursor) : await provider.searchAccounts(params);
    } catch (err) {
      lastError = err;
      attempt++;
      await logActivity({
        jobId,
        action: "provider_error",
        metadata: { error: err instanceof Error ? err.message : String(err), attempt },
      });
      if (attempt < MAX_PAGE_RETRIES) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Provider page fetch failed");
}

interface AccountOutcome {
  isNew: boolean;
  isLead: boolean;
  temperature: string;
}

async function processAccount(
  jobId: string,
  account: NormalizedAccount,
  params: SearchJobRow["parameters"],
): Promise<AccountOutcome> {
  if (params.minFollowers && (account.followersCount ?? 0) < params.minFollowers) {
    return { isNew: false, isLead: false, temperature: "LOW" };
  }
  if (params.maxFollowers && (account.followersCount ?? 0) > params.maxFollowers) {
    return { isNew: false, isLead: false, temperature: "LOW" };
  }

  const { id: socialAccountId, isNew } = await upsertSocialAccount(account);

  await query(
    `insert into discovery_results (search_job_id, social_account_id, source, discovery_method, raw_data)
     values ($1, $2, $3, $4, $5)`,
    [jobId, socialAccountId, "mock", "search", JSON.stringify(account.rawData)],
  );

  const qualification = await qualifyWithCache(
    socialAccountId,
    {
      name: account.displayName,
      bio: account.bio,
      location: account.city,
      language: account.language,
      website: account.website,
      followersCount: account.followersCount,
      postsCount: account.postsCount,
    },
    defaultQualificationService,
  );

  const market = classifyMarket({
    name: account.displayName,
    bio: account.bio,
    language: account.language,
    languages: account.languages,
    country: account.country,
    city: account.city,
  });

  const scoring = scoreLead({
    specialty: qualification.specialty,
    contentTags: qualification.relevant_services,
    followersCount: account.followersCount,
    hasWebsite: Boolean(account.website),
    clinicIdentified: qualification.lead_type === "clinic",
    hasPublicBusinessEmail: Boolean(account.email),
    isActiveAccount: !qualification.red_flags.includes("inactive_account"),
    targetMarket: market.market,
    targetMarketConfidence: market.confidence,
    negativeFlags: {
      dentalStudent: qualification.red_flags.includes("dental_student"),
      dentalLaboratory: qualification.red_flags.includes("dental_laboratory"),
      dentalSupplier: qualification.red_flags.includes("dental_supplier"),
      inactive: qualification.red_flags.includes("inactive_account"),
      clearlyUnrelated: qualification.red_flags.includes("clearly_unrelated"),
    },
  });

  const isLead = qualification.qualification_status !== "not_a_lead";
  if (isLead) {
    const lead = await upsertLead({ socialAccountId, account, qualification, market, scoring });
    if (isNew) {
      await logActivity({
        jobId,
        leadId: lead.id,
        action: "lead_created",
        metadata: { score: scoring.totalScore, temperature: scoring.temperature, market: market.market },
      });
    }
  }

  return { isNew, isLead, temperature: scoring.temperature };
}

export interface RunJobOptions {
  /** Stop after this many batches — used by tests to simulate a crash mid-job. */
  maxBatches?: number;
  /** Inject a specific provider instance (e.g. a MockDiscoveryProvider configured for a test) instead of resolving one from job.provider. */
  providerOverride?: LeadDiscoveryProvider;
}

/**
 * Runs (or resumes) a single search job to completion, honoring pause/cancel
 * requests observed on each batch boundary, and checkpointing after every
 * batch so a crash or an explicit stop can always resume from the last
 * successfully processed page instead of restarting the whole search.
 */
export async function runSearchJob(jobId: string, options: RunJobOptions = {}): Promise<void> {
  const job = await getSearchJob(jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);

  await query(
    `update search_jobs set status = 'running', started_at = coalesce(started_at, now()), updated_at = now() where id = $1`,
    [jobId],
  );

  const provider = options.providerOverride ?? getProvider(job.provider);
  const params = job.parameters;

  let cursor: string | null = job.cursor;
  let batchNumber = await getNextBatchNumber(jobId);
  let totalDiscovered = job.total_discovered;
  let totalProcessed = job.total_processed;
  let totalQualified = job.total_qualified;
  let totalFailed = job.total_failed;
  let totalEstimate: number | undefined;
  let batchesRun = 0;

  await logActivity({ jobId, action: "job_started", metadata: { resumedFromCursor: Boolean(cursor) } });

  // If resuming, prefer the last confirmed checkpoint's cursor over whatever
  // is on the job row, in case the row was updated mid-batch before a crash.
  const latestCheckpoint = await getLatestCheckpoint(jobId);
  if (latestCheckpoint) {
    cursor = latestCheckpoint.cursor;
  }

  await updateJobProgress(jobId, { stage: "discovering" });

  while (true) {
    const status = await getJobStatus(jobId);
    if (status === "paused" || status === "cancelled") {
      await logActivity({ jobId, action: `job_${status}` });
      return;
    }

    if (options.maxBatches !== undefined && batchesRun >= options.maxBatches) {
      await logActivity({ jobId, action: "job_stopped_for_test", metadata: { batchesRun } });
      return;
    }

    let page: DiscoveryPage;
    try {
      page = await fetchPageWithRetry(provider, jobId, params, cursor);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await recordCheckpoint({
        jobId,
        stage: "discovering",
        cursor,
        batchNumber,
        itemsProcessed: 0,
        status: "failed",
      });
      await query(`update search_jobs set retry_count = retry_count + 1 where id = $1`, [jobId]);
      await query(
        `update search_jobs set status = 'failed', error_message = $2, updated_at = now() where id = $1`,
        [jobId, message],
      );
      await logActivity({ jobId, action: "job_failed", metadata: { error: message, batchNumber } });
      return;
    }

    totalEstimate = page.totalEstimate ?? totalEstimate;
    totalDiscovered += page.accounts.length;

    await updateJobProgress(jobId, { stage: "qualifying", totalDiscovered });

    let batchQualified = 0;
    let batchFailed = 0;
    for (const account of page.accounts) {
      try {
        const outcome = await processAccount(jobId, account, params);
        totalProcessed++;
        if (outcome.isLead) batchQualified++;
      } catch (err) {
        // One failed account must never kill the batch or the job.
        batchFailed++;
        totalFailed++;
        await logActivity({
          jobId,
          action: "account_processing_failed",
          metadata: {
            platformAccountId: account.platformAccountId,
            error: err instanceof Error ? err.message : String(err),
          },
        });
      }
    }
    totalQualified += batchQualified;

    cursor = page.nextCursor;
    batchesRun++;

    await recordCheckpoint({
      jobId,
      stage: page.hasMore ? "discovering" : "completed",
      cursor,
      batchNumber,
      itemsProcessed: page.accounts.length,
      status: "completed",
    });

    const progressPercent = totalEstimate
      ? Math.min(page.hasMore ? 99 : 100, Math.round((totalDiscovered / totalEstimate) * 100))
      : page.hasMore
        ? 50
        : 100;

    await updateJobProgress(jobId, {
      stage: page.hasMore ? "discovering" : "market_classification",
      cursor,
      progressPercent,
      totalDiscovered,
      totalProcessed,
      totalQualified,
      totalFailed,
    });

    await logActivity({
      jobId,
      action: "batch_completed",
      metadata: { batchNumber, processed: page.accounts.length, qualified: batchQualified, failed: batchFailed },
    });

    batchNumber++;

    if (!page.hasMore) break;
  }

  await updateJobProgress(jobId, { stage: "completed", progressPercent: 100 });
  await query(
    `update search_jobs set status = 'completed', stage = 'completed', completed_at = now(), updated_at = now() where id = $1`,
    [jobId],
  );
  await logActivity({ jobId, action: "job_completed", metadata: { totalDiscovered, totalProcessed, totalQualified, totalFailed } });
}
