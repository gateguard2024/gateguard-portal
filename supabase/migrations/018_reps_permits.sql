-- ============================================================
-- GateGuard OS — Migration 018: Sales Reps + Permits
--
-- 1. sales_reps  — rep hierarchy under each dealer org
-- 2. rep_commissions — monthly payout records per rep
-- 3. permits — gate permits, fire marshal certs, HOA certs per site
-- ============================================================


-- ============================================================
-- PART 1 — Sales Reps
-- A rep belongs to an org (dealer). They may have a parent rep
-- (sub-rep model). commission_rate is their cut of the dealer
-- pool in dollars per door per month.
-- ============================================================

create type if not exists rep_tier as enum ('senior_rep', 'rep', 'sub_rep');

create table if not exists sales_reps (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  user_id           text,                               -- Clerk user ID (nullable — not all reps have portal access)
  name              text not null,
  email             text,
  phone             text,
  tier              rep_tier not null default 'rep',
  parent_rep_id     uuid references sales_reps(id) on delete set null,
  commission_rate   numeric(6,2) not null default 0,    -- $/door/month from dealer pool
  pipeline_value    numeric(12,2) not null default 0,   -- cached from CRM opportunities
  active_sites      int not null default 0,             -- cached count of assigned properties
  is_active         boolean not null default true,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists sales_reps_org_id_idx      on sales_reps(org_id);
create index if not exists sales_reps_parent_rep_idx  on sales_reps(parent_rep_id);


-- ============================================================
-- PART 2 — Rep Commission Payouts
-- One row per rep per pay period (YYYY-MM format).
-- ============================================================

create type if not exists commission_status as enum ('pending', 'approved', 'paid', 'held');

create table if not exists rep_commissions (
  id              uuid primary key default gen_random_uuid(),
  rep_id          uuid not null references sales_reps(id) on delete cascade,
  org_id          uuid not null references organizations(id) on delete cascade,
  pay_period      char(7) not null,             -- "2026-05" format
  amount_cents    int not null default 0,       -- payout in cents
  door_count      int not null default 0,       -- doors included in this payout
  status          commission_status not null default 'pending',
  paid_at         timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (rep_id, pay_period)
);

create index if not exists rep_commissions_rep_id_idx     on rep_commissions(rep_id);
create index if not exists rep_commissions_org_id_idx     on rep_commissions(org_id);
create index if not exists rep_commissions_pay_period_idx on rep_commissions(pay_period);


-- ============================================================
-- PART 3 — Permits
-- Gate permits, fire marshal certs, HOA certificates, city
-- licenses per site. Status is computed at query time from
-- expiry_date vs now().
-- ============================================================

create type if not exists permit_type as enum (
  'gate_permit',
  'fire_marshal',
  'hoa_certificate',
  'city_license',
  'electrical_permit',
  'low_voltage_license',
  'other'
);

create table if not exists permits (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  site_id         uuid references sites(id) on delete set null,
  type            permit_type not null,
  label           text,                         -- optional override display name
  issued_by       text,                         -- e.g. "City of Atlanta"
  permit_number   text,
  issue_date      date,
  expiry_date     date,
  document_url    text,                         -- Supabase Storage URL for permit PDF/image
  notes           text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists permits_org_id_idx    on permits(org_id);
create index if not exists permits_site_id_idx   on permits(site_id);
create index if not exists permits_expiry_idx    on permits(expiry_date) where is_active = true;

-- Computed status view — makes querying easy
create or replace view permits_with_status as
select
  p.*,
  s.name as site_name,
  case
    when p.expiry_date is null                     then 'no_expiry'
    when p.expiry_date < current_date              then 'expired'
    when p.expiry_date < current_date + interval '60 days' then 'expiring_soon'
    else 'compliant'
  end as status,
  (p.expiry_date - current_date) as days_remaining
from permits p
left join sites s on s.id = p.site_id
where p.is_active = true;


-- ============================================================
-- PART 4 — RLS Policies (org-scoped)
-- ============================================================

alter table sales_reps enable row level security;
alter table rep_commissions enable row level security;
alter table permits enable row level security;

-- Sales reps: visible to same org or corporate
create policy "sales_reps_org_read" on sales_reps
  for select using (
    org_id::text = current_setting('app.current_org_id', true)
    or current_setting('app.is_corporate', true) = 'true'
  );

create policy "sales_reps_org_write" on sales_reps
  for all using (
    org_id::text = current_setting('app.current_org_id', true)
    or current_setting('app.is_corporate', true) = 'true'
  );

-- Rep commissions: same scoping
create policy "rep_commissions_org_read" on rep_commissions
  for select using (
    org_id::text = current_setting('app.current_org_id', true)
    or current_setting('app.is_corporate', true) = 'true'
  );

create policy "rep_commissions_org_write" on rep_commissions
  for all using (
    org_id::text = current_setting('app.current_org_id', true)
    or current_setting('app.is_corporate', true) = 'true'
  );

-- Permits: same scoping
create policy "permits_org_read" on permits
  for select using (
    org_id::text = current_setting('app.current_org_id', true)
    or current_setting('app.is_corporate', true) = 'true'
  );

create policy "permits_org_write" on permits
  for all using (
    org_id::text = current_setting('app.current_org_id', true)
    or current_setting('app.is_corporate', true) = 'true'
  );
