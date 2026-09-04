import { afterAll, describe, expect, it } from "vitest";
import { getPool, query } from "@/lib/db";
import { createSearchJob, getSearchJob } from "@/lib/services/jobs";
import { runSearchJob } from "@/lib/services/job-runner";
import { getLatestCheckpoint } from "@/lib/services/checkpoints";
import { MockDiscoveryProvider } from "@/lib/providers/mock-provider";
import type { SearchJobParameters } from "@/lib/types";

// These exercise the full job engine against a real Postgres database
// (DATABASE_URL from .env.local). They are skipped automatically when no
// database is configured (e.g. a plain CI checkout with no Postgres).
const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("Job engine — checkpoint/resume, retry, dedup (integration)", () => {
  afterAll(async () => {
    await getPool().end();
  });

  it("CRITICAL: force-fails a batch containing account #47, then resumes from the last checkpoint instead of restarting", async () => {
    const params: SearchJobParameters = {
      country: "Israel",
      cities: ["Test City A"],
      targetMarket: "ARAB_48",
    };
    const job = await createSearchJob({ name: "critical-test-checkpoint-resume", provider: "mock", parameters: params });

    // pageSize 25 => batch 2 covers accounts 26-50, which includes account #47.
    // forceFailAlwaysAtBatch exhausts every in-run retry, so the job must go to 'failed'.
    const failingProvider = new MockDiscoveryProvider({
      pageSize: 25,
      delayMs: 0,
      failureRate: 0,
      totalOverride: 100,
      forceFailAlwaysAtBatch: [2],
    });

    await runSearchJob(job.id, { providerOverride: failingProvider });

    const afterFailure = await getSearchJob(job.id);
    expect(afterFailure?.status).toBe("failed");
    expect(afterFailure?.total_discovered).toBe(25); // only batch 1 succeeded

    const checkpoint = await getLatestCheckpoint(job.id);
    expect(checkpoint?.batch_number).toBe(1);
    expect(checkpoint?.status).toBe("completed");

    // Simulate a full restart: a brand-new provider instance (no forced failure left).
    const freshProvider = new MockDiscoveryProvider({
      pageSize: 25,
      delayMs: 0,
      failureRate: 0,
      totalOverride: 100,
    });
    await runSearchJob(job.id, { providerOverride: freshProvider });

    const finalJob = await getSearchJob(job.id);
    expect(finalJob?.status).toBe("completed");
    expect(finalJob?.total_discovered).toBe(100); // did NOT restart from zero
    expect(Number(finalJob?.progress_percent)).toBe(100);
  });

  it("retries a transient page failure automatically within a single run and continues (no job restart needed)", async () => {
    const params: SearchJobParameters = {
      country: "Israel",
      cities: ["Test City B"],
      targetMarket: "ARAB_48",
    };
    const job = await createSearchJob({ name: "critical-test-inline-retry", provider: "mock", parameters: params });

    const provider = new MockDiscoveryProvider({
      pageSize: 25,
      delayMs: 0,
      failureRate: 0,
      totalOverride: 120,
      forceFailOnceAtBatch: [3], // fires once; fetchPageWithRetry's 2nd attempt succeeds
    });

    await runSearchJob(job.id, { providerOverride: provider });

    const finalJob = await getSearchJob(job.id);
    expect(finalJob?.status).toBe("completed");
    expect(finalJob?.total_discovered).toBe(120);
    expect(finalJob?.retry_count).toBe(0); // inline retry succeeded — never hit the job-level failure path
  });

  it("CRITICAL: running the identical search twice never creates duplicate leads for the same account", async () => {
    const params: SearchJobParameters = {
      country: "Israel",
      cities: ["Test City C"],
      targetMarket: "ARAB_48",
      specialty: "Cosmetic Dentistry",
    };

    const jobA = await createSearchJob({ name: "dup-test-run-A", provider: "mock", parameters: params });
    const jobB = await createSearchJob({ name: "dup-test-run-B", provider: "mock", parameters: params });

    const providerA = new MockDiscoveryProvider({ pageSize: 20, delayMs: 0, failureRate: 0, totalOverride: 60 });
    const providerB = new MockDiscoveryProvider({ pageSize: 20, delayMs: 0, failureRate: 0, totalOverride: 60 });

    await runSearchJob(jobA.id, { providerOverride: providerA });
    await runSearchJob(jobB.id, { providerOverride: providerB });

    const finalA = await getSearchJob(jobA.id);
    const finalB = await getSearchJob(jobB.id);
    expect(finalA?.status).toBe("completed");
    expect(finalB?.status).toBe("completed");
    // Identical params => identical deterministic mock population.
    expect(finalA?.total_discovered).toBe(finalB?.total_discovered);

    const accountIds = await query<{ id: string }>(
      `select id from social_accounts where platform_account_id like 'mock_%' and city = 'Test City C'`,
    );
    // 60 unique accounts total, not 120 — the second run must update, not duplicate.
    expect(accountIds.length).toBeLessThanOrEqual(60);

    const dupLeads = await query<{ social_account_id: string; count: string }>(
      `select social_account_id, count(*) from leads
       where social_account_id = any($1::uuid[])
       group by social_account_id
       having count(*) > 1`,
      [accountIds.map((r) => r.id)],
    );
    expect(dupLeads.length).toBe(0);
  });

  it("one failed account does not kill the batch or the job", async () => {
    // Sanity check on the per-account try/catch: even though the mock
    // provider itself won't throw per-account, this asserts total_failed
    // stays a well-formed counter and the job still completes.
    const params: SearchJobParameters = {
      country: "Israel",
      cities: ["Test City D"],
      targetMarket: "ARAB_48",
    };
    const job = await createSearchJob({ name: "resilience-test", provider: "mock", parameters: params });
    const provider = new MockDiscoveryProvider({ pageSize: 20, delayMs: 0, failureRate: 0, totalOverride: 40 });
    await runSearchJob(job.id, { providerOverride: provider });
    const finalJob = await getSearchJob(job.id);
    expect(finalJob?.status).toBe("completed");
    expect(finalJob?.total_failed).toBe(0);
    expect(finalJob?.total_processed).toBe(40);
  });
});
