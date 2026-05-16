-- ============================================================
-- GateGuard OS — Migration 017: Dealer Network Hierarchy
--
-- 1. Extend org_tier enum with the full 7-tier model
-- 2. Add relationship columns to organizations
-- 3. commission_config table — per-org rate configuration
-- 4. dealer_add_ons table — per-site add-on activations
-- ============================================================


-- ============================================================
-- PART 1 — Extend org_tier enum
-- Postgres requires each ADD VALUE in its own transaction.
-- We use "if not exists" so this is idempotent.
-- ============================================================

do $$ begin
  alter type org_tier add value if not exists 'full_dealer';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type org_tier add value if not exists 'service_dealer';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type org_tier add value if not exists 'install_contractor';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type org_tier add value if not exists 'sales_partner';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type org_tier add value if not exists 'master_dealer';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type org_tier add value if not exists 'master_agent';
exception when duplicate_object then null; end $$;


-- ============================================================
-- PART 2 — Add relationship + status columns to organizations
-- ============================================================

alter table organizations
  add column if not exists master_agent_id      uuid references organizations(id) on delete set null,
  add column if not exists parent_org_id        uuid references organizations(id) on delete set null,
  add column if not exists is_active            boolean not null default true,
  add column if not exists onboarding_complete  boolean not null default false;

-- master_dealer_id already exists on the sites table from migration 012.
-- Add it to organizations as well (which master dealer this org belongs to).
alter table organizations
  add column if not exists master_dealer_id uuid references organizations(id) on delete set null;

-- Backfill tier_label for new tier values
update organizations
set tier_label = case tier
  when 'full_dealer'        then 'Full Dealership'
  when 'install_contractor' then 'Installing Contractor'
  when 'sales_partner'      then 'Sales Partner'
  else tier_label
end
where tier in ('full_dealer', 'install_contractor', 'sales_partner')
  and (tier_label is null or tier_label = tier::text);

-- Indexes for hierarchy traversal
create index if not exists idx_orgs_master_agent  on organizations(master_agent_id)  where master_agent_id is not null;
create index if not exists idx_orgs_master_dealer on organizations(master_dealer_id) where master_dealer_id is not null;
create index if not exists idx_orgs_parent_org    on organizations(parent_org_id)    where parent_org_id is not null;
create index if not exists idx_orgs_is_active     on organizations(is_active);


-- ============================================================
-- PART 3 — commission_config
--
-- One row per organization. Full Dealership (master_dealer) sets
-- the default template for their network.
--
-- Business model:
--   Property pays:        $10.00 / unit / month
--   GateGuard keeps:       $5.00 (gross margin)
--   Dealer pool:           $5.00 distributed as:
--     master_agent_rate:   $0.50  (fixed, off top)
--     master_dealer_rate:  $0.50  (fixed, off top)
--     configurable $4.00 remainder:
--       sales_partner_rate:  default $1.00
--       service_dealer_rate: default $3.00
--   install_contractor:    $0.00 recurring (one-time only)
-- ============================================================

create table if not exists commission_config (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references organizations(id) on delete cascade,

  -- Fixed tiers (non-configurable, shown locked in UI)
  master_agent_rate    numeric(5,2) not null default 0.50,
  master_dealer_rate   numeric(5,2) not null default 0.50,

  -- Configurable pool ($4.00 available; sales + service <= 4.00)
  sales_partner_rate   numeric(5,2) not null default 1.00,
  service_dealer_rate  numeric(5,2) not null default 3.00,

  -- Optional notes (e.g. "negotiated rate for Atlanta market")
  notes                text,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  unique(org_id),

  -- Enforce that the configurable pool stays within $4.00
  constraint chk_commission_pool
    check (sales_partner_rate + service_dealer_rate <= 4.00),

  -- No negative rates
  constraint chk_commission_non_negative
    check (
      master_agent_rate   >= 0 and
      master_dealer_rate  >= 0 and
      sales_partner_rate  >= 0 and
      service_dealer_rate >= 0
    )
);

-- Trigger: auto-update updated_at
create or replace function set_commission_config_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_commission_config_updated_at on commission_config;
create trigger trg_commission_config_updated_at
  before update on commission_config
  for each row execute function set_commission_config_updated_at();

-- RLS
alter table commission_config enable row level security;

-- GateGuard admins (service_role) can do anything
create policy "service_role_all_commission_config"
  on commission_config
  using (true)
  with check (true);

-- Indexes
create index if not exists idx_commission_config_org on commission_config(org_id);


-- ============================================================
-- PART 4 — dealer_add_ons
--
-- Per-site add-on activations. Revenue split: 50/50 GateGuard/Dealer.
-- add_on_type values:
--   video_monitoring  — Eagle Eye monitoring package
--   callbox           — cloud-managed callbox service
--   lpr               — license plate recognition
--   kiosk             — resident/visitor kiosk
--   elevator_access   — Brivo elevator floor control
-- ============================================================

create table if not exists dealer_add_ons (
  id               uuid primary key default gen_random_uuid(),
  site_id          uuid not null references sites(id) on delete cascade,
  org_id           uuid references organizations(id) on delete set null,  -- dealer earning the add-on split

  add_on_type      text not null check (
                     add_on_type in (
                       'video_monitoring',
                       'callbox',
                       'lpr',
                       'kiosk',
                       'elevator_access'
                     )
                   ),

  unit_count       int  not null default 0,
  camera_count     int  not null default 0,
  monthly_retail   numeric(10,2) not null default 0,  -- what the property pays
  is_active        boolean not null default true,
  activated_at     timestamptz not null default now(),
  created_at       timestamptz not null default now(),

  unique(site_id, add_on_type)
);

-- RLS
alter table dealer_add_ons enable row level security;

create policy "service_role_all_dealer_add_ons"
  on dealer_add_ons
  using (true)
  with check (true);

-- Indexes
create index if not exists idx_dealer_add_ons_site   on dealer_add_ons(site_id);
create index if not exists idx_dealer_add_ons_org    on dealer_add_ons(org_id)    where org_id is not null;
create index if not exists idx_dealer_add_ons_active on dealer_add_ons(is_active) where is_active = true;
