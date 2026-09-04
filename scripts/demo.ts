import { config } from "dotenv";
config({ path: ".env.local" });
import { createSearchJob, getSearchJob } from "../src/lib/services/jobs";
import { runSearchJob } from "../src/lib/services/job-runner";
import { listLeads } from "../src/lib/services/leads";
import { getPool } from "../src/lib/db";

// Runs the exact first-demo scenario from the master spec end-to-end against
// whatever DATABASE_URL points at, and prints a summary of the resulting leads.

async function main() {
  const job = await createSearchJob({
    name: "Israel — Arab 48 Cosmetic Dentists (Nazareth, Umm al-Fahm)",
    provider: "mock",
    parameters: {
      country: "Israel",
      cities: ["Nazareth", "Umm al-Fahm"],
      targetMarket: "ARAB_48",
      specialty: "Cosmetic Dentistry",
      languages: ["ar", "he"],
      minFollowers: 1000,
    },
  });

  console.log(`Created job ${job.id}`);
  await runSearchJob(job.id);

  const finalJob = await getSearchJob(job.id);
  console.log("\n=== JOB RESULT ===");
  console.log(JSON.stringify(finalJob, null, 2));

  const leads = await listLeads({ targetMarket: "ARAB_48", sort: "score", limit: 20 });
  console.log(`\n=== TOP ARAB_48 LEADS (${leads.length}) ===`);
  for (const lead of leads as any[]) {
    console.log(
      `${lead.lead_score.toString().padStart(4)} ${lead.lead_temperature.padEnd(12)} ${(lead.person_name ?? lead.username).padEnd(30)} ${lead.city ?? ""} conf=${lead.market_confidence}`,
    );
  }

  await getPool().end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
