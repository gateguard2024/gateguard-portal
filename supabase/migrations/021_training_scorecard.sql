-- ============================================================
-- GateGuard OS — Migration 021: Training Progress + Scorecard Cache
-- ============================================================

-- ============================================================
-- PART 1 — training_progress table
-- Tracks per-user chapter completions for the /training page.
-- user_id = Clerk user ID (text, not FK since Clerk manages users)
-- ============================================================

create table if not exists training_progress (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,       -- Clerk user ID
  org_id       uuid references organizations(id) on delete set null,
  user_name    text,                -- denormalized from Clerk for display
  user_email   text,                -- denormalized from Clerk for display

  course_id    text not null,       -- matches COURSES[].id in training page
  chapter_id   text not null,       -- matches chapter id within course

  completed_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),

  unique (user_id, course_id, chapter_id)
);

-- RLS: service role only (API handles auth)
alter table training_progress enable row level security;
create policy "service_role_all_training_progress"
  on training_progress using (true) with check (true);

-- Indexes
create index if not exists idx_training_progress_user   on training_progress(user_id);
create index if not exists idx_training_progress_org    on training_progress(org_id) where org_id is not null;
create index if not exists idx_training_progress_course on training_progress(course_id);


-- ============================================================
-- PART 2 — dealer_scorecards table (optional cache)
-- Can cache computed scorecard values to avoid re-computation on every load.
-- The /api/scorecard route computes live from WO data — this table is
-- for storing snapshots (e.g. weekly cron job) and historical trend data.
-- ============================================================

create table if not exists dealer_scorecards (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id) on delete cascade,
  period           char(7) not null,  -- "YYYY-MM" (monthly snapshots)

  score            int not null default 0,   -- 0-100 composite
  response_time_hrs numeric(6,2),
  fcr_pct          int,
  compliance_pct   int,
  uptime_pct       int,
  nps_proxy        int,
  total_wos        int default 0,
  certified        boolean not null default false,

  computed_at      timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

alter table dealer_scorecards enable row level security;
create policy "service_role_all_dealer_scorecards"
  on dealer_scorecards using (true) with check (true);

create unique index if not exists idx_dealer_scorecards_org_period on dealer_scorecards(org_id, period);
create index if not exists idx_dealer_scorecards_org              on dealer_scorecards(org_id);
create index if not exists idx_dealer_scorecards_score            on dealer_scorecards(score);
