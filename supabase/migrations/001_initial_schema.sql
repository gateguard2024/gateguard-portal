-- ============================================================
-- GateGuard OS — Initial Schema (Phase 1)
-- Run this in Supabase SQL Editor in order
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- fast text search

-- ============================================================
-- ENUMS
-- ============================================================

create type org_tier as enum (
  'corporate',   -- Tier 0: GateGuard HQ
  'mso',         -- Tier 1: Master System Operator
  'dealer',      -- Tier 2: System Operator / Dealer
  'partner',     -- Tier 3: Sales Channel Partner
  'client'       -- Tier 4: Property / End Client
);

create type user_role as enum (
  'corporate_admin',
  'mso_admin',
  'dealer_admin',
  'dealer_staff',
  'partner_admin',
  'client_admin',
  'client_viewer'
);

create type account_status as enum ('active', 'inactive', 'suspended', 'onboarding');
create type device_status  as enum ('online', 'offline', 'warning', 'unknown');
create type quote_status   as enum ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired');
create type wo_status      as enum ('open', 'in_progress', 'scheduled', 'completed', 'cancelled');
create type wo_priority    as enum ('low', 'medium', 'high', 'critical');
create type invoice_status as enum ('draft', 'sent', 'paid', 'overdue', 'void');
create type lead_stage     as enum ('prospect', 'qualified', 'proposal', 'negotiation', 'won', 'lost');

-- ============================================================
-- ORGANIZATIONS (the 5-tier hierarchy)
-- ============================================================

create table organizations (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  tier          org_tier not null,
  parent_id     uuid references organizations(id) on delete set null,
  slug          text unique,                        -- for white-label URLs
  logo_url      text,
  primary_color text default '#22d3ee',
  status        account_status default 'active',

  -- Contact
  primary_email   text,
  primary_phone   text,
  address         text,
  city            text,
  state           text,
  zip             text,

  -- Integration IDs (set during onboarding)
  eagleeye_account_id   text,
  brivo_account_id      text,
  brivo_site_id         text,
  quickbooks_realm_id   text,

  -- Metadata
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Seed: GateGuard Corporate (Tier 0)
insert into organizations (id, name, tier, slug, primary_email)
values (
  '00000000-0000-0000-0000-000000000001',
  'GateGuard, LLC',
  'corporate',
  'gateguard',
  'rfeldman@gateguard.co'
);

-- ============================================================
-- PROFILES (one per Clerk user)
-- ============================================================

create table profiles (
  id              uuid primary key default uuid_generate_v4(),
  clerk_user_id   text unique not null,   -- maps to Clerk user ID
  org_id          uuid not null references organizations(id),
  role            user_role not null,

  first_name      text,
  last_name       text,
  email           text not null,
  phone           text,
  avatar_url      text,

  -- Preferences
  theme           text default 'dark',
  notifications_email boolean default true,
  notifications_sms   boolean default true,

  last_login_at   timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- PROPERTIES (physical sites under a client org)
-- ============================================================

create table properties (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organizations(id) on delete cascade,
  name            text not null,
  address         text,
  city            text,
  state           text,
  zip             text,
  property_type   text,   -- 'multifamily' | 'hoa' | 'commercial'
  unit_count      int,

  -- Integration IDs
  eagleeye_location_id text,
  brivo_site_id        text,

  status          device_status default 'unknown',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- DEVICES (cameras, doors, bridges, panels, callboxes)
-- ============================================================

create table devices (
  id              uuid primary key default uuid_generate_v4(),
  property_id     uuid not null references properties(id) on delete cascade,
  org_id          uuid not null references organizations(id),

  name            text not null,
  device_type     text not null,  -- 'camera' | 'door' | 'bridge' | 'panel' | 'callbox'
  manufacturer    text,           -- 'eagleeye' | 'brivo' | 'ubiquiti' | 'gateguard'
  model           text,
  serial_number   text,

  -- Integration IDs
  eagleeye_device_id text,
  brivo_device_id    text,

  status          device_status default 'unknown',
  ip_address      text,
  firmware_version text,
  install_date    date,
  warranty_expires date,

  last_seen_at    timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- CONTACTS (people within an org/client)
-- ============================================================

create table contacts (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organizations(id) on delete cascade,
  first_name  text,
  last_name   text,
  email       text,
  phone       text,
  title       text,
  is_primary  boolean default false,
  notes       text,
  created_at  timestamptz default now()
);

-- ============================================================
-- QUOTES
-- ============================================================

create table quotes (
  id              uuid primary key default uuid_generate_v4(),
  quote_number    text unique not null,  -- GG-2026-001
  org_id          uuid not null references organizations(id),  -- the dealer
  client_org_id   uuid references organizations(id),           -- the client being quoted
  created_by      uuid references profiles(id),

  title           text not null,
  status          quote_status default 'draft',
  total_one_time  numeric(10,2) default 0,
  total_mrr       numeric(10,2) default 0,

  valid_until     date,
  accepted_at     timestamptz,
  signed_by       text,

  notes           text,
  pdf_url         text,
  share_token     text unique default encode(gen_random_bytes(16), 'hex'),

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table quote_line_items (
  id          uuid primary key default uuid_generate_v4(),
  quote_id    uuid not null references quotes(id) on delete cascade,
  sort_order  int default 0,
  category    text,   -- 'hardware' | 'labor' | 'saas' | 'service'
  description text not null,
  qty         int default 1,
  unit_price  numeric(10,2) not null,
  is_recurring boolean default false,
  created_at  timestamptz default now()
);

-- ============================================================
-- WORK ORDERS
-- ============================================================

create table work_orders (
  id              uuid primary key default uuid_generate_v4(),
  wo_number       text unique not null,   -- WO-2026-001
  org_id          uuid not null references organizations(id),
  client_org_id   uuid references organizations(id),
  property_id     uuid references properties(id),
  device_id       uuid references devices(id),
  created_by      uuid references profiles(id),
  assigned_to     uuid references profiles(id),

  title           text not null,
  description     text,
  priority        wo_priority default 'medium',
  status          wo_status default 'open',

  due_date        date,
  completed_at    timestamptz,

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- INVOICES
-- ============================================================

create table invoices (
  id              uuid primary key default uuid_generate_v4(),
  invoice_number  text unique not null,  -- INV-2026-001
  org_id          uuid not null references organizations(id),
  client_org_id   uuid references organizations(id),
  created_by      uuid references profiles(id),

  title           text,
  status          invoice_status default 'draft',
  is_recurring    boolean default false,
  amount          numeric(10,2) not null,

  due_date        date,
  paid_at         timestamptz,

  quickbooks_invoice_id text,

  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- CRM — LEADS
-- ============================================================

create table leads (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organizations(id),
  assigned_to     uuid references profiles(id),

  company_name    text,
  contact_name    text,
  email           text,
  phone           text,
  property_type   text,
  unit_count      int,
  location        text,

  stage           lead_stage default 'prospect',
  source          text,   -- 'referral' | 'website' | 'cold' | 'partner'
  partner_org_id  uuid references organizations(id),

  notes           text,
  won_at          timestamptz,
  lost_at         timestamptz,
  lost_reason     text,

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- ACTIVITY LOG (CRM timeline)
-- ============================================================

create table activity_log (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organizations(id),
  actor_id    uuid references profiles(id),

  entity_type text not null,  -- 'lead' | 'client' | 'work_order' | 'quote' | 'invoice'
  entity_id   uuid not null,

  action      text not null,  -- 'created' | 'updated' | 'called' | 'emailed' | 'visited' | 'note'
  description text,

  created_at  timestamptz default now()
);

-- ============================================================
-- INDEXES (performance)
-- ============================================================

create index idx_organizations_parent    on organizations(parent_id);
create index idx_organizations_tier      on organizations(tier);
create index idx_profiles_clerk          on profiles(clerk_user_id);
create index idx_profiles_org            on profiles(org_id);
create index idx_properties_org          on properties(org_id);
create index idx_devices_property        on devices(property_id);
create index idx_devices_org             on devices(org_id);
create index idx_devices_status          on devices(status);
create index idx_quotes_org              on quotes(org_id);
create index idx_quotes_client           on quotes(client_org_id);
create index idx_work_orders_org         on work_orders(org_id);
create index idx_work_orders_assigned    on work_orders(assigned_to);
create index idx_invoices_org            on invoices(org_id);
create index idx_leads_org               on leads(org_id);
create index idx_activity_entity         on activity_log(entity_type, entity_id);

-- ============================================================
-- UPDATED_AT triggers
-- ============================================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_organizations_updated_at before update on organizations for each row execute function update_updated_at();
create trigger trg_profiles_updated_at      before update on profiles      for each row execute function update_updated_at();
create trigger trg_properties_updated_at    before update on properties    for each row execute function update_updated_at();
create trigger trg_devices_updated_at       before update on devices       for each row execute function update_updated_at();
create trigger trg_quotes_updated_at        before update on quotes        for each row execute function update_updated_at();
create trigger trg_work_orders_updated_at   before update on work_orders   for each row execute function update_updated_at();
create trigger trg_invoices_updated_at      before update on invoices      for each row execute function update_updated_at();
create trigger trg_leads_updated_at         before update on leads         for each row execute function update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table organizations  enable row level security;
alter table profiles        enable row level security;
alter table properties      enable row level security;
alter table devices         enable row level security;
alter table contacts        enable row level security;
alter table quotes          enable row level security;
alter table quote_line_items enable row level security;
alter table work_orders     enable row level security;
alter table invoices        enable row level security;
alter table leads           enable row level security;
alter table activity_log    enable row level security;

-- Helper function: get the calling user's org_id from their Clerk JWT
create or replace function auth_org_id() returns uuid as $$
  select org_id from profiles where clerk_user_id = auth.jwt() ->> 'sub'
$$ language sql security definer;

-- Helper function: get the calling user's role
create or replace function auth_role() returns user_role as $$
  select role from profiles where clerk_user_id = auth.jwt() ->> 'sub'
$$ language sql security definer;

-- Organizations: users see their own org + children
create policy "orgs_select" on organizations for select using (
  id = auth_org_id()
  or parent_id = auth_org_id()
  or id in (
    select id from organizations
    where parent_id in (
      select id from organizations where parent_id = auth_org_id()
    )
  )
);

-- Profiles: users see profiles within their org subtree
create policy "profiles_select" on profiles for select using (
  org_id = auth_org_id()
);

-- Properties: users see properties under their managed orgs
create policy "properties_select" on properties for select using (
  org_id = auth_org_id()
  or org_id in (select id from organizations where parent_id = auth_org_id())
);

-- Devices: follow properties
create policy "devices_select" on devices for select using (
  org_id = auth_org_id()
  or org_id in (select id from organizations where parent_id = auth_org_id())
);

-- Quotes, WOs, Invoices, Leads: org-scoped
create policy "quotes_select"      on quotes      for select using (org_id = auth_org_id() or client_org_id = auth_org_id());
create policy "wo_select"          on work_orders for select using (org_id = auth_org_id() or client_org_id = auth_org_id());
create policy "invoices_select"    on invoices    for select using (org_id = auth_org_id() or client_org_id = auth_org_id());
create policy "leads_select"       on leads       for select using (org_id = auth_org_id());
create policy "contacts_select"    on contacts    for select using (org_id = auth_org_id());
create policy "activity_select"    on activity_log for select using (org_id = auth_org_id());
create policy "line_items_select"  on quote_line_items for select using (
  quote_id in (select id from quotes where org_id = auth_org_id() or client_org_id = auth_org_id())
);

-- ============================================================
-- DONE
-- ============================================================
-- Next migration: 002_eagleeye_events.sql (Phase 2)
-- Next migration: 003_brivo_events.sql    (Phase 2)
