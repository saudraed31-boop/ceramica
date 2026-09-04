-- AI qualification result cache (section 16): avoid re-qualifying unchanged data.
create table if not exists qualification_results (
  id uuid primary key default gen_random_uuid(),
  social_account_id uuid not null references social_accounts(id) on delete cascade,
  input_hash text not null,
  provider text not null,
  prompt_version text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique (social_account_id, input_hash, prompt_version)
);

create index if not exists idx_qualification_results_account on qualification_results (social_account_id);
