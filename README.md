# Ceramica Lead Generator

Internal lead-generation platform for Ceramica Dental Lab: discover, qualify,
score, and manage dentist/clinic leads, with a first-class Arab-48 market
classification engine.

## Architecture

```
Browser (Next.js dashboard)
      -> creates a search_jobs row (status=queued) and returns immediately
Postgres (source of truth: jobs, checkpoints, accounts, leads)
      <- polled by -> Worker (scripts/worker.ts, a separate persistent process)
Worker -> LeadDiscoveryProvider (pluggable; MockDiscoveryProvider today)
       -> dedup (unique platform+platform_account_id)
       -> LeadQualificationService (heuristic today, AI-backed later)
       -> MarketClassificationService (Arab-48 engine)
       -> Lead scoring engine
       -> leads / lead_scores / activity_log
```

The browser is never the worker: closing the tab, changing tabs, or shutting
down the machine does not stop a running job. Every batch is checkpointed
(`job_checkpoints`), so a crash or transient provider failure resumes from the
last successful batch instead of restarting the search.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL (Supabase Postgres, or a local Postgres for dev)
npm run migrate               # applies migrations/*.sql
npm run seed                  # seeds keyword_groups, target_locations, a demo user
npm run dev                   # dashboard at http://localhost:3000
npm run worker                # separate terminal: the persistent background worker
```

To run the exact first-demo scenario from the command line:

```bash
npm run demo
```

This creates the "Israel — Arab 48 Cosmetic Dentists (Nazareth, Umm al-Fahm)"
job and runs it to completion against the mock provider, printing the
resulting leads.

## Tests

```bash
npm test
```

Includes the 10 Arab-48 classification test cases, the full scoring matrix,
qualification heuristics (dental student/lab/supplier rejection, high-value
detection), and integration tests against a real Postgres database covering:

- **Checkpoint/resume**: force a persistent failure at the batch containing
  account #47, confirm the job fails without losing progress, then confirm a
  fresh worker run resumes from the last checkpoint instead of restarting.
- **Inline retry**: a single transient failure is retried automatically
  within one run and the job completes without ever going to `failed`.
- **Dedup**: running the identical search twice never creates a second lead
  for the same discovered account.

Integration tests are skipped automatically if `DATABASE_URL` isn't set.

## What's implemented (Phases 0-3 of the master spec)

- Full Postgres schema (`migrations/`) matching the spec's tables, with the
  `(platform, platform_account_id)` and `(social_account_id)` uniqueness
  constraints that make dedup structural, not best-effort.
- `LeadDiscoveryProvider` abstraction (`src/lib/providers/types.ts`) and a
  `MockDiscoveryProvider` that simulates hundreds of accounts, real
  cursor-based pagination, transient failures, and duplicate accounts
  reappearing across pages — everything needed to build and test the job
  engine before any real data source is connected.
- Search job engine with queued/running/paused/completed/failed/cancelled
  statuses, per-batch checkpoints, exponential-backoff retry on provider
  errors, and per-account isolation (one failed account never kills a batch).
- `MarketClassificationService`: the Arab-48 engine, driven by multiple
  independent signals (script detection on name/bio, Arabic/Hebrew dental
  terminology, and a configurable target-location database) — never a single
  weak signal. Returns `UNKNOWN` when evidence is insufficient.
- `LeadQualificationService`: a deterministic heuristic implementation today
  (dental student / lab / supplier / unrelated rejection, specialty and
  service detection, high-value promotion), built so a future AI-backed
  implementation is a drop-in replacement. Results are cached per account in
  `qualification_results`.
- Configurable lead scoring engine (`src/lib/config/scoring.ts`) — all
  numbers live in one file, nothing scattered through the codebase.
- Dashboard: home stats, search job list/create/detail (with pause / resume /
  cancel / retry-from-checkpoint), leads list with filters, lead detail with
  market signals and score breakdown, plus early analytics and a settings
  view of the seeded keyword/location config.

## Known gaps / next steps

- **Auth**: Supabase Auth wiring needs a real Supabase project (this
  environment has none) — the DB layer already talks to plain Postgres so
  pointing `DATABASE_URL` at a Supabase project's connection string is the
  remaining step; the dashboard has no login gate yet.
- **Keyword/location config is still read from `src/lib/config/*.ts`** at
  runtime, even though the `keyword_groups` / `target_locations` tables are
  seeded — wiring the classification/discovery code to read from Postgres
  (with a cache) so the Settings page can edit them live is the natural next
  slice, deliberately deferred to avoid overbuilding ahead of what this first
  milestone needed.
- **Phases 6-9** (a real discovery provider, CRM Kanban, Google Sheets sync,
  full analytics) are intentionally not built yet, per the master spec's
  "build incrementally" instruction — the provider abstraction and schema
  are already shaped for them.
