-- Migration 010: EOS (Entrepreneurial Operating System) Tables
-- Persists V/TO, Rocks, Scorecard, Issues, and To-Dos per organization

-- ─── EOS V/TO ─────────────────────────────────────────────────────────────────
create table if not exists eos_vto (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,

  -- Vision Side
  core_values jsonb default '[]'::jsonb,         -- [{ n: int, title: string, desc: string }]
  purpose text,                                    -- Core Focus: Purpose/Cause/Passion
  niche text,                                      -- Core Focus: Niche
  ten_year_target text,                            -- 10-Year Target

  -- Marketing Strategy
  target_market text,
  three_uniques jsonb default '[]'::jsonb,        -- [string]
  proven_process jsonb default '[]'::jsonb,        -- [string] — steps in order
  guarantee text,

  -- Traction Side
  picture_3yr jsonb default '{}'::jsonb,           -- { revenue, profit, employees, feeling, looks_like }
  plan_1yr jsonb default '{}'::jsonb,              -- { revenue, goals: [string] }

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Only one V/TO per org (upsert on org_id)
create unique index if not exists eos_vto_org_id_idx on eos_vto(org_id);

-- ─── EOS Rocks ─────────────────────────────────────────────────────────────────
create table if not exists eos_rocks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  quarter text not null,                           -- e.g. "Q2 2026"
  name text not null,
  owner text not null,
  status text not null default 'On Track'
    check (status in ('On Track', 'At Risk', 'Off Track', 'Complete')),
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  due_date text not null default 'Jun 30',        -- display string e.g. "Jun 30"
  is_company_rock boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists eos_rocks_org_quarter_idx on eos_rocks(org_id, quarter);

-- ─── EOS Scorecard ─────────────────────────────────────────────────────────────
create table if not exists eos_scorecard (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  owner text not null,
  goal text not null,                              -- e.g. "3/wk", "$50K/mo", "99.9%"
  unit text,                                       -- optional unit for display
  sort_order integer default 0,
  created_at timestamptz default now()
);

create table if not exists eos_scorecard_entries (
  id uuid primary key default gen_random_uuid(),
  scorecard_id uuid references eos_scorecard(id) on delete cascade,
  week_of date not null,                           -- ISO date of Monday for the week
  value text,                                      -- raw value string e.g. "12", "99.9%", "—"
  created_at timestamptz default now()
);

create unique index if not exists eos_scorecard_entries_unique
  on eos_scorecard_entries(scorecard_id, week_of);

-- ─── EOS Issues ─────────────────────────────────────────────────────────────────
create table if not exists eos_issues (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  description text not null,
  type text not null default 'Company'
    check (type in ('Company', 'Department', 'People')),
  owner text not null,
  priority text not null default 'Normal'
    check (priority in ('Critical', 'High', 'Normal')),
  status text not null default 'Open'
    check (status in ('Open', 'This Meeting', 'In Progress', 'Parking Lot', 'Resolved')),
  created_at timestamptz default now(),
  resolved_at timestamptz,
  resolution_note text
);

create index if not exists eos_issues_org_status_idx on eos_issues(org_id, status);

-- ─── EOS To-Dos ─────────────────────────────────────────────────────────────────
create table if not exists eos_todos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  text text not null,
  owner text not null,
  due_date date,
  meeting text,                                    -- e.g. "L10 5/23"
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists eos_todos_org_done_idx on eos_todos(org_id, done);

-- ─── Updated_at triggers ───────────────────────────────────────────────────────
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists eos_vto_updated_at on eos_vto;
create trigger eos_vto_updated_at
  before update on eos_vto
  for each row execute function update_updated_at_column();

drop trigger if exists eos_rocks_updated_at on eos_rocks;
create trigger eos_rocks_updated_at
  before update on eos_rocks
  for each row execute function update_updated_at_column();

-- ─── RLS ───────────────────────────────────────────────────────────────────────
-- Using service role key in API routes, so no RLS policies needed yet.
-- Enable RLS but leave policies open for now; tighten per org_id when dealer auth matures.
alter table eos_vto enable row level security;
alter table eos_rocks enable row level security;
alter table eos_scorecard enable row level security;
alter table eos_scorecard_entries enable row level security;
alter table eos_issues enable row level security;
alter table eos_todos enable row level security;

-- Service role bypass (all API routes use SUPABASE_SERVICE_ROLE_KEY)
create policy "Service role full access" on eos_vto for all using (true);
create policy "Service role full access" on eos_rocks for all using (true);
create policy "Service role full access" on eos_scorecard for all using (true);
create policy "Service role full access" on eos_scorecard_entries for all using (true);
create policy "Service role full access" on eos_issues for all using (true);
create policy "Service role full access" on eos_todos for all using (true);
