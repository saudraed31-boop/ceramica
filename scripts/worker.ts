import { config } from "dotenv";
config({ path: ".env.local" });
import { claimNextQueuedJob } from "../src/lib/services/jobs";
import { runSearchJob } from "../src/lib/services/job-runner";
import { getPool } from "../src/lib/db";

// Standalone, persistent background worker. Run this as a long-lived
// process (systemd service, container, Fly.io/Railway app, etc.) or on a
// schedule (e.g. a Supabase Edge Function invoked every minute). It has no
// dependency on any browser tab — the dashboard only ever reads job state
// from Postgres, it never drives the work itself.
//
// Usage:
//   npm run worker            # poll forever
//   npm run worker -- --once  # process any currently queued jobs, then exit

const POLL_INTERVAL_MS = 3000;
const once = process.argv.includes("--once");

async function tick(): Promise<boolean> {
  const job = await claimNextQueuedJob();
  if (!job) return false;
  console.log(`[worker] claimed job ${job.id} (${job.name})`);
  try {
    await runSearchJob(job.id);
    console.log(`[worker] job ${job.id} finished`);
  } catch (err) {
    console.error(`[worker] job ${job.id} crashed:`, err);
  }
  return true;
}

async function main() {
  console.log(`[worker] starting (${once ? "single pass" : "continuous poll"})`);
  if (once) {
    // Drain every currently queued job, then exit.
    while (await tick()) {
      /* keep going */
    }
    await getPool().end();
    return;
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const worked = await tick();
    if (!worked) await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main().catch((err) => {
  console.error("[worker] fatal error:", err);
  process.exit(1);
});
