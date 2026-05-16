-- ============================================================
-- GateGuard OS — Migration 018: Sales Reps + Permits
--
-- 1. sales_reps table — rep hierarchy with commission rates
-- 2. rep_commissions table — monthly commission records
-- 3. permits table — property compliance tracking
-- 4. permits_with_status view — computed status + days_remaining
-- ============================================================


-- ============================================================
-- PART 1 — Rep tier enum + sales_reps table
-- ============================================================

do $$ begin
  create type rep_tier as enum ('senior_rep', 'rep', 'sub_rep');
exception when duplicate_object then null; end $$;

create table if not exists sales_reps (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id) on delete cascade,
  parent_rep_id    uuid references sales_reps(id) on delete set null,

  first_name       text not null,
  last_name        text not null,
  email            text,
  phone            text,
  tier             rep_tier not null default 'rep',

  commission_rate  numeric(5,4) not null default 0.05,  -- e.g. 0.05 = 5%
  pipeline_value   numeric(12,2) not null default 0,    -- cached from opportunities
  active_sites     int not null default 0,              -- sites currently serviced

  is_active        boolean not null default true,
  joined_at        timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Trigger: auto-update updated_at
create or replace function set_sales_reps_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sales_reps_updated_at on sales_reps;
create trigger trg_sales_reps_updated_at
  before update on sales_reps
  for each row execute function set_sales_reps_updated_at();

-- RLS
alter table sales_reps enable row level security;

create policy "service_role_all_sales_reps"
  on sales_reps
  using (true)
  with check (true);

-- Indexes
create index if not exists idx_sales_reps_org        on sales_reps(org_id);
create index if not exists idx_sales_reps_parent     on sales_reps(parent_rep_id) where parent_rep_id is not null;
create index if not exists idx_sales_reps_active     on sales_reps(is_active) where is_active = true;
create index if not exists idx_sales_reps_tier       on sales_reps(tier);


-- ============================================================
-- PART 2 — Commission status enum + rep_commissions table
-- ============================================================

do $$ begin
  create type commission_status as enum ('pending', 'approved', 'paid', 'held');
exception when duplicate_object then null; end $$;

create table if not exists rep_commissions (
  id               uuid primary key default gen_random_uuid(),
  rep_id           uuid not null references sales_reps(id) on delete cascade,
  org_id           uuid references organizations(id) on delete set null,

  pay_period       char(7) not null,  -- "YYYY-MM" e.g. "2026-05"
  amount_cents     int not null default 0,  -- stored in cents to avoid float issues
  status           commission_status not null default 'pending',

  -- Reference back to what generated this commission
  source_type      text,  -- 'site_mrr', 'quote', 'add_on', 'bonus'
  source_id        uuid,  -- FK to the generating record (quotes.id, dealer_add_ons.id, etc.)

  notes            text,
  approved_by      text,  -- clerk_user_id of approver
  approved_at      timestamptz,
  paid_at          timestamptz,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Trigger: auto-update updated_at
create or replace function set_rep_commissions_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_rep_commissions_updated_at on rep_commissions;
create trigger trg_rep_commissions_updated_at
  before update on rep_commissions
  for each row execute function set_rep_commissions_updated_at();

-- RLS
alter table rep_commissions enable row level security;

create policy "service_role_all_rep_commissions"
  on rep_commissions
  using (true)
  with check (true);

-- Indexes
create index if not exists idx_rep_commissions_rep      on rep_commissions(rep_id);
create index if not exists idx_rep_commissions_org      on rep_commissions(org_id) where org_id is not null;
create index if not exists idx_rep_commissions_period   on rep_commissions(pay_period);
create index if not exists idx_rep_commissions_status   on rep_commissions(status);


-- ============================================================
-- PART 3 — Permit type enum + permits table
-- ============================================================

do $$ begin
  create type permit_type as enum (
    'gate_permit',
    'fire_marshal',
    'hoa_certificate',
    'city_license',
    'electrical_permit',
    'low_voltage_license',
    'other'
  );
exception when duplicate_object then null; end $$;

create table if not exists permits (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id) on delete cascade,
  site_id          uuid references sites(id) on delete cascade,

  type             permit_type not null,
  label            text,           -- optional human name (e.g. "Atlanta Gate Permit 2024")
  permit_number    text,
  issued_by        text,           -- issuing authority / inspector name
  issue_date       date,
  expiry_date      date,
  document_url     text,           -- Supabase Storage URL for the permit PDF

  notes            text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Trigger: auto-update updated_at
create or replace function set_permits_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_permits_updated_at on permits;
create trigger trg_permits_updated_at
  before update on permits
  for each row execute function set_permits_updated_at();

-- RLS
alter table permits enable row level security;

create policy "service_role_all_permits"
  on permits
  using (true)
  with check (true);

-- Indexes
create index if not exists idx_permits_org        on permits(org_id);
create index if not exists idx_permits_site       on permits(site_id) where site_id is not null;
create index if not exists idx_permits_type       on permits(type);
create index if not exists idx_permits_expiry     on permits(expiry_date) where expiry_date is not null;
create index if not exists idx_permits_active     on permits(is_active) where is_active = true;


-- ============================================================
-- PART 4 — permits_with_status view
--
-- Computes compliance status at query time using current_date:
--   compliant      → expiry_date > today + 30 days
--   expiring_soon  → expiry_date within next 30 days
--   expired        → expiry_date in the past
--   no_expiry      → no expiry_date set
-- ============================================================

create or replace view permits_with_status as
select
  p.*,
  s.name as site_name,
  case
    when p.expiry_date is null        then 'no_expiry'::text
    when p.expiry_date < current_date then 'expired'::text
    when p.expiry_date <= current_date + interval '30 days' then 'expiring_soon'::text
    else 'compliant'::text
  end as status,
  case
    when p.expiry_date is null then null
    else (p.expiry_date - current_date)::int
  end as days_remaining
from permits p
left join sites s on s.id = p.site_id
where p.is_active = true;
