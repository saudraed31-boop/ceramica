-- Ceramica Lead Generator — initial schema
-- Runs against Supabase Postgres or a local Postgres instance.
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

-- ============================================================
-- USERS
-- ============================================================
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- KEYWORD_GROUPS — configurable discovery keyword sets
-- ============================================================
create table if not exists keyword_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  language text not null check (language in ('ar', 'he', 'en', 'mixed')),
  category text not null,
  keywords jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- TARGET_LOCATIONS — configurable location/market signal database
-- ============================================================
create table if not exists target_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null,
  arabic_name text,
  hebrew_name text,
  target_market text not null default 'UNKNOWN',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SEARCH_JOBS
-- ============================================================
create table if not exists search_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  name text not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'paused', 'completed', 'failed', 'cancelled')),
  provider text not null default 'mock',
  parameters jsonb not null default '{}'::jsonb,
  stage text not null default 'initializing'
    check (stage in (
      'initializing', 'discovering', 'enriching', 'qualifying',
      'market_classification', 'scoring', 'deduplicating', 'completed'
    )),
  progress_percent numeric(5, 2) not null default 0,
  total_discovered integer not null default 0,
  total_processed integer not null default 0,
  total_qualified integer not null default 0,
  total_failed integer not null default 0,
  cursor text,
  retry_count integer not null default 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  last_heartbeat timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_search_jobs_status on search_jobs (status);
create index if not exists idx_search_jobs_user on search_jobs (user_id);

-- ============================================================
-- SOCIAL_ACCOUNTS
-- ============================================================
create table if not exists social_accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'instagram',
  platform_account_id text not null,
  username text,
  display_name text,
  profile_url text,
  profile_image_url text,
  bio text,
  followers_count integer,
  following_count integer,
  posts_count integer,
  verified boolean not null default false,
  country text,
  city text,
  language text,
  languages jsonb not null default '[]'::jsonb,
  website text,
  email text,
  phone text,
  raw_data jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, platform_account_id)
);

create index if not exists idx_social_accounts_username on social_accounts (username);
create index if not exists idx_social_accounts_city on social_accounts (city);

-- ============================================================
-- LEADS
-- ============================================================
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  social_account_id uuid references social_accounts(id) on delete cascade,
  lead_type text not null default 'unknown'
    check (lead_type in ('dentist', 'clinic', 'unknown', 'not_a_lead')),
  person_name text,
  clinic_name text,
  specialty text,
  country text,
  city text,
  target_market text not null default 'UNKNOWN',
  market_confidence numeric(4, 3) not null default 0,
  market_signals jsonb not null default '[]'::jsonb,
  website text,
  email text,
  phone text,
  lead_score integer not null default 0,
  lead_temperature text not null default 'LOW'
    check (lead_temperature in ('HOT', 'WARM', 'QUALIFIED', 'LOW', 'DISQUALIFIED')),
  qualification_status text not null default 'possible_lead'
    check (qualification_status in ('not_a_lead', 'possible_lead', 'qualified', 'high_value')),
  sales_status text not null default 'NEW'
    check (sales_status in (
      'NEW', 'QUALIFIED', 'CONTACTED', 'REPLIED', 'INTERESTED',
      'SAMPLE_REQUESTED', 'NEGOTIATION', 'CONVERTED', 'NOT_INTERESTED', 'LOST'
    )),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (social_account_id)
);

create index if not exists idx_leads_score on leads (lead_score desc);
create index if not exists idx_leads_temperature on leads (lead_temperature);
create index if not exists idx_leads_target_market on leads (target_market);
create index if not exists idx_leads_sales_status on leads (sales_status);
create index if not exists idx_leads_country_city on leads (country, city);

-- ============================================================
-- LEAD_SCORES — versioned score history
-- ============================================================
create table if not exists lead_scores (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  total_score integer not null,
  score_breakdown jsonb not null default '{}'::jsonb,
  scoring_version text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_scores_lead on lead_scores (lead_id);

-- ============================================================
-- DISCOVERY_RESULTS
-- ============================================================
create table if not exists discovery_results (
  id uuid primary key default gen_random_uuid(),
  search_job_id uuid not null references search_jobs(id) on delete cascade,
  social_account_id uuid references social_accounts(id) on delete set null,
  source text not null,
  discovery_method text not null,
  raw_data jsonb not null default '{}'::jsonb,
  discovered_at timestamptz not null default now()
);

create index if not exists idx_discovery_results_job on discovery_results (search_job_id);

-- ============================================================
-- JOB_CHECKPOINTS
-- ============================================================
create table if not exists job_checkpoints (
  id uuid primary key default gen_random_uuid(),
  search_job_id uuid not null references search_jobs(id) on delete cascade,
  stage text not null,
  cursor text,
  batch_number integer not null,
  items_processed integer not null default 0,
  status text not null default 'completed'
    check (status in ('completed', 'failed', 'in_progress')),
  created_at timestamptz not null default now()
);

create index if not exists idx_job_checkpoints_job on job_checkpoints (search_job_id, batch_number);

-- ============================================================
-- OUTREACH
-- ============================================================
create table if not exists outreach (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  channel text not null default 'instagram_dm',
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'delivered', 'read', 'replied', 'failed')),
  message text,
  contacted_at timestamptz,
  response_at timestamptz,
  notes text
);

create index if not exists idx_outreach_lead on outreach (lead_id);

-- ============================================================
-- TAGS / LEAD_TAGS
-- ============================================================
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists lead_tags (
  lead_id uuid not null references leads(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (lead_id, tag_id)
);

-- ============================================================
-- ACTIVITY_LOG
-- ============================================================
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  lead_id uuid references leads(id) on delete cascade,
  job_id uuid references search_jobs(id) on delete cascade,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_log_job on activity_log (job_id, created_at desc);
create index if not exists idx_activity_log_lead on activity_log (lead_id, created_at desc);
