-- ============================================================
-- GateGuard OS — Migration 008: CRM Full Build
-- Adds GG-specific opportunity fields, stage history,
-- lead assignment, opportunity contacts, and demo seed data
-- Safe to run whether or not migration 002 has been applied
-- ============================================================

-- ============================================================
-- ENUMS — add new values (additive, never removes)
-- ============================================================

-- New opportunity stages matching GateGuard/Salesforce flow
do $$ begin
  create type opp_stage_gg as enum (
    'meet_present',   -- Meet & Present
    'survey_request', -- Survey Request
    'propose',        -- Propose
    'negotiate',      -- Negotiate
    'won',            -- Closed Won
    'lost',           -- Lost
    'dead'            -- Dead (no activity)
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type opp_type as enum (
    'property',       -- Multifamily property install
    'dealer_signup',  -- New dealer onboarding
    'channel_partner',-- DirecTV / channel partner
    'renewal',        -- Contract renewal
    'upsell'          -- Existing customer upsell
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type activity_type_gg as enum (
    'call', 'email', 'meeting', 'note', 'task', 'sms',
    'demo', 'site_walk', 'proposal_sent', 'contract_sent'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type forecast_cat as enum (
    'pipeline', 'best_case', 'commit', 'closed', 'omitted'
  );
exception when duplicate_object then null; end $$;

-- ============================================================
-- OPPORTUNITIES — add all GateGuard-specific fields
-- ============================================================

-- Core deal fields (if table exists from 002, these are additive)
create table if not exists opportunities (
  id              uuid primary key default gen_random_uuid(),
  dealer_org_id   uuid,
  name            text not null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table opportunities
  add column if not exists opp_type        text default 'property',
  add column if not exists stage           text default 'meet_present',
  add column if not exists probability     integer default 20 check (probability between 0 and 100),
  add column if not exists forecast_cat    text default 'pipeline',
  add column if not exists close_date      date,
  add column if not exists won_at          timestamptz,
  add column if not exists lost_at         timestamptz,
  add column if not exists lost_reason     text,
  add column if not exists next_step       text,
  add column if not exists description     text,

  -- Ownership
  add column if not exists owner_name      text default 'Russel Feldman',
  add column if not exists owner_initials  text default 'RF',
  add column if not exists rep_id          uuid,

  -- Account / Property
  add column if not exists account_name    text,
  add column if not exists management_co   text,
  add column if not exists owner_entity    text,
  add column if not exists property_address text,
  add column if not exists property_city   text,
  add column if not exists property_state  text default 'GA',

  -- Site contact
  add column if not exists site_contact_name  text,
  add column if not exists site_contact_title text default 'Property Manager',
  add column if not exists site_contact_phone text,
  add column if not exists site_contact_email text,

  -- Property specs (GateGuard-specific)
  add column if not exists units              integer,
  add column if not exists vehicle_gates      integer,
  add column if not exists pedestrian_gates   integer,
  add column if not exists amenity_doors      integer,
  add column if not exists existing_cameras   integer,
  add column if not exists new_cameras        integer,

  -- Financial
  add column if not exists amount             numeric(12,2),
  add column if not exists est_deposit        numeric(12,2) default 0,
  add column if not exists monthly_per_unit   numeric(10,2),
  add column if not exists monthly_total      numeric(12,2),
  add column if not exists est_mrr            numeric(12,2),
  add column if not exists est_arr            numeric(12,2),

  -- DirecTV / Channel fields
  add column if not exists dtv_package        text,
  add column if not exists isp_service        text,
  add column if not exists mdu_contract_expiry date,
  add column if not exists dtv_bulk_value     numeric(12,2),

  -- Portal links
  add column if not exists quote_url          text,
  add column if not exists quote_id           uuid,
  add column if not exists survey_session_id  text,

  -- Source
  add column if not exists source             text default 'direct',
  add column if not exists assigned_from_lead uuid;

-- Force stage + opp_type columns to text in case migration 002 created them
-- as the old opp_stage / opp_type enums with different values
alter table opportunities
  alter column stage type text using stage::text,
  alter column opp_type type text using opp_type::text;

-- Make dealer_org_id nullable — seed data and show leads don't always have an org
alter table opportunities alter column dealer_org_id drop not null;

-- ============================================================
-- OPPORTUNITY STAGE HISTORY
-- ============================================================

create table if not exists opportunity_stage_history (
  id              uuid primary key default gen_random_uuid(),
  opportunity_id  uuid not null references opportunities(id) on delete cascade,
  stage           text not null,
  amount          numeric(12,2),
  probability     integer,
  changed_by_name text,
  changed_at      timestamptz default now()
);

create index if not exists idx_opp_stage_hist on opportunity_stage_history(opportunity_id, changed_at desc);

-- ============================================================
-- OPPORTUNITY CONTACTS (Contact Roles)
-- ============================================================

create table if not exists opportunity_contacts (
  id              uuid primary key default gen_random_uuid(),
  opportunity_id  uuid not null references opportunities(id) on delete cascade,
  contact_name    text not null,
  contact_title   text,
  contact_email   text,
  contact_phone   text,
  role            text default 'Site Contact',  -- 'Decision Maker', 'Technical', 'Billing', etc.
  is_primary      boolean default false,
  created_at      timestamptz default now()
);

create index if not exists idx_opp_contacts on opportunity_contacts(opportunity_id);

-- ============================================================
-- ACTIVITIES (CRM timeline — calls, emails, tasks, meetings)
-- ============================================================

create table if not exists crm_activities (
  id              uuid primary key default gen_random_uuid(),
  opportunity_id  uuid references opportunities(id) on delete cascade,
  lead_id         uuid,
  contact_name    text,
  type            text not null default 'note',  -- call, email, meeting, note, task, demo, site_walk
  subject         text not null,
  body            text,
  outcome         text,   -- for calls: 'connected', 'voicemail', 'no_answer'
  direction       text,   -- 'inbound' | 'outbound'
  duration_min    integer,  -- call duration
  due_at          timestamptz,
  completed_at    timestamptz,
  created_by_name text default 'Russel Feldman',
  created_at      timestamptz default now()
);

create index if not exists idx_crm_act_opp  on crm_activities(opportunity_id, created_at desc);
create index if not exists idx_crm_act_lead on crm_activities(lead_id, created_at desc);
create index if not exists idx_crm_act_due  on crm_activities(due_at) where completed_at is null;

-- ============================================================
-- SHOW LEAD ASSIGNMENTS (assign Atlanta show leads to dealers)
-- ============================================================

create table if not exists show_lead_assignments (
  id              uuid primary key default gen_random_uuid(),
  show_lead_id    uuid not null references show_leads(id) on delete cascade,
  assigned_to     text not null,   -- dealer name or email
  assigned_by     text default 'Russel Feldman',
  note            text,
  status          text default 'new',  -- new, contacted, converted, passed
  converted_opp_id uuid references opportunities(id) on delete set null,
  assigned_at     timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_lead_assign on show_lead_assignments(show_lead_id);

-- Add assigned_dealer column to show_leads for quick single-dealer assignment
alter table show_leads add column if not exists assigned_dealer text;

-- ============================================================
-- UPDATED_AT TRIGGER (reuse existing function if present)
-- ============================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_opps_updated_at on opportunities;
create trigger trg_opps_updated_at
  before update on opportunities
  for each row execute function set_updated_at();

drop trigger if exists trg_lead_assign_updated_at on show_lead_assignments;
create trigger trg_lead_assign_updated_at
  before update on show_lead_assignments
  for each row execute function set_updated_at();

-- ============================================================
-- STAGE HISTORY TRIGGER — auto-log every stage change
-- ============================================================

create or replace function log_stage_change()
returns trigger as $$
begin
  if old.stage is distinct from new.stage then
    insert into opportunity_stage_history
      (opportunity_id, stage, amount, probability, changed_by_name)
    values
      (new.id, new.stage, new.amount, new.probability, new.owner_name);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_log_stage on opportunities;
create trigger trg_log_stage
  after update on opportunities
  for each row execute function log_stage_change();

-- ============================================================
-- SEED DATA — opportunities from real GateGuard pipeline
-- (mirrors actual Salesforce data from screenshots)
-- ============================================================

insert into opportunities (
  name, stage, amount, probability, forecast_cat, close_date,
  account_name, management_co, site_contact_name,
  site_contact_phone, site_contact_title,
  owner_name, owner_initials, source,
  property_state, opp_type, description
) values

-- ── MEET & PRESENT ($230K) ──────────────────────────────────
('Grayson Park Estates — Your GateGuard',
 'meet_present', 100000, 20, 'pipeline', '2026-03-31',
 'Grayson Park Estates', 'Grayson Park Estates', null,
 null, 'Property Manager', 'Russel Feldman', 'RF', 'direct', 'GA', 'property',
 'Full access control + camera system proposal'),

('General Proposal — Perennial Properties',
 'meet_present', 30000, 20, 'pipeline', '2026-04-30',
 'Perennial Properties', 'Perennial Properties', null,
 null, 'Property Manager', 'Russel Feldman', 'RF', 'direct', 'GA', 'property',
 'General GateGuard platform proposal'),

('The Hamilton — Your GateGuard',
 'meet_present', 100000, 20, 'pipeline', '2026-04-30',
 'The Hamilton', 'The Hamilton', null,
 null, 'Property Manager', 'Russel Feldman', 'RF', 'direct', 'GA', 'property',
 'Access control + gate system'),

-- ── PROPOSE ($1.7M) ─────────────────────────────────────────
('Avondale Hills by Elevate — Your GateGuard',
 'propose', 144141.20, 50, 'pipeline', '2026-03-31',
 'Avondale Hills by Elevate', 'Avondale Hills by Elevate', 'Tori Knowles',
 '678.712.5500', 'Property Manager', 'Russel Feldman', 'RF', 'direct', 'GA', 'property',
 'Full gate, intercom, camera and access system — Elevate model'),

('Barrington Hills — Your GateGuard',
 'propose', 100000, 50, 'pipeline', '2026-04-10',
 'Barrington Hills', 'Barrington Hills', null,
 null, 'Property Manager', 'Russel Feldman', 'RF', 'direct', 'GA', 'property',
 'Complete GateGuard platform installation'),

('Columbia Crest — Your GateGuard',
 'propose', 150000, 50, 'pipeline', '2026-01-31',
 'Columbia Crest', 'Columbia Crest', null,
 null, 'Property Manager', 'Russel Feldman', 'RF', 'direct', 'GA', 'property',
 'Full access + surveillance system'),

('Columbia Gardens at South City — Your GateGuard',
 'propose', 150000, 50, 'pipeline', '2026-01-31',
 'Columbia Gardens at South City', 'Columbia Gardens', null,
 null, 'Property Manager', 'Russel Feldman', 'RF', 'direct', 'GA', 'property',
 'GateGuard platform + camera expansion'),

('GateGuard Addendum — Columbia Residential',
 'propose', 801, 50, 'pipeline', '2026-04-15',
 'Columbia Residential', 'Columbia Residential', null,
 null, 'Property Manager', 'Russel Feldman', 'RF', 'direct', 'GA', 'property',
 'Add-on services to existing install'),

('Midwood Gardens — Camera Expansion',
 'propose', 45000, 50, 'pipeline', '2026-05-01',
 'Midwood Gardens', 'Midwood Gardens Mgmt', null,
 null, 'Property Manager', 'Russel Feldman', 'RF', 'direct', 'GA', 'property',
 'Camera expansion + gate upgrade'),

('Parkview Estates — Full Platform',
 'propose', 120000, 50, 'pipeline', '2026-04-20',
 'Parkview Estates', 'Parkview Management', null,
 null, 'Property Manager', 'Russel Feldman', 'RF', 'direct', 'GA', 'property',
 'Full GateGuard platform + Elevate MRR model'),

-- ── NEGOTIATE ($1.3M) ────────────────────────────────────────
('Your GateGuard — 1401 West Paces Ferry',
 'negotiate', 80000, 75, 'best_case', '2026-04-30',
 '1401 West Paces Ferry', 'West Paces Properties', null,
 null, 'Property Manager', 'Russel Feldman', 'RF', 'direct', 'GA', 'property',
 'Gate system + camera installation — in contract negotiation'),

('Camera System — 92 West Paces',
 'negotiate', 30000, 75, 'best_case', '2026-04-10',
 '92W. Paces', '92 West Paces LLC', null,
 null, 'Property Manager', 'Russel Feldman', 'RF', 'direct', 'GA', 'property',
 'Camera-only scope'),

('Adamsville Green — Cameras',
 'negotiate', 20000, 75, 'best_case', '2026-01-31',
 'Adamsville Green', 'Adamsville Green Mgmt', null,
 null, 'Property Manager', 'Russel Feldman', 'RF', 'direct', 'GA', 'property',
 'Camera system upgrade'),

('2026 Your GateGuard for Artesian East Village',
 'negotiate', 150000, 75, 'best_case', '2026-01-31',
 'Artesian East Village', 'Artesian Communities', null,
 null, 'Property Manager', 'Russel Feldman', 'RF', 'direct', 'GA', 'property',
 'Full GateGuard platform for new development'),

('Camera & Gate Proposal — Avana Chase',
 'negotiate', 20000, 75, 'best_case', '2026-03-31',
 'Avana Chase', 'Avana Properties', null,
 null, 'Property Manager', 'Russel Feldman', 'RF', 'direct', 'GA', 'property',
 'Camera and gate proposal under negotiation'),

('Mitul Patel — Camera System',
 'negotiate', 15000, 75, 'best_case', '2026-04-15',
 'Mitul Patel', null, 'Mitul Patel',
 null, 'Owner', 'Russel Feldman', 'RF', 'referral', 'GA', 'property',
 'Residential/boutique property camera system'),

-- ── CLOSED WON ($246K) ──────────────────────────────────────
('Your GateGuard — The Villages on Riverwalk',
 'won', 175000, 100, 'closed', '2026-03-19',
 'The Villages on Riverwalk', 'Riverwalk Properties', null,
 null, 'Property Manager', 'Russel Feldman', 'RF', 'direct', 'GA', 'property',
 'Complete GateGuard installation — CLOSED'),

('Gardens at Camp Creek — Cameras',
 'won', 61830, 100, 'closed', '2026-02-27',
 'Radco', 'Radco Management', null,
 null, 'Regional Manager', 'Nicole Gagliardi', 'NG', 'direct', 'GA', 'property',
 'Camera system — CLOSED'),

('Aster Buckhead — Gate Service',
 'won', 5030, 100, 'closed', '2026-02-27',
 'Radco', 'Radco Management', null,
 null, 'Regional Manager', 'Russel Feldman', 'RF', 'direct', 'GA', 'property',
 'Gate service agreement — CLOSED'),

('Rhythm at Riverdale — Network Bridge',
 'won', 5000, 100, 'closed', '2026-03-10',
 'Rhythm at Riverdale', 'Rhythm Management', null,
 null, 'Property Manager', 'Russel Feldman', 'RF', 'direct', 'GA', 'property',
 'Network bridge installation — CLOSED'),

('Add 2x 2-Way Audio Cameras — Mitul Patel',
 'won', 3000, 100, 'closed', '2026-03-19',
 'Mitul Patel', null, 'Mitul Patel',
 null, 'Owner', 'Russel Feldman', 'RF', 'referral', 'GA', 'property',
 'Audio camera add-on — CLOSED')

on conflict do nothing;

-- ============================================================
-- SEED STAGE HISTORY for closed won deals
-- ============================================================

insert into opportunity_stage_history
  (opportunity_id, stage, amount, probability, changed_by_name, changed_at)
select
  id, 'meet_present', amount * 0.8, 20, owner_name,
  created_at + interval '1 day'
from opportunities where stage = 'won' and name like '%Villages%'
union all
select
  id, 'survey_request', amount * 0.85, 30, owner_name,
  created_at + interval '7 days'
from opportunities where stage = 'won' and name like '%Villages%'
union all
select
  id, 'propose', amount * 0.9, 50, owner_name,
  created_at + interval '21 days'
from opportunities where stage = 'won' and name like '%Villages%'
union all
select
  id, 'negotiate', amount, 75, owner_name,
  created_at + interval '35 days'
from opportunities where stage = 'won' and name like '%Villages%'
union all
select
  id, 'won', amount, 100, owner_name,
  won_at
from opportunities where stage = 'won' and name like '%Villages%'
on conflict do nothing;

-- ============================================================
-- DONE
-- ============================================================
-- Run this in Supabase SQL editor:
-- supabase/migrations/008_crm_full.sql
-- ============================================================

-- ============================================================
-- USER PERMISSIONS TABLE
-- Stores granular per-user portal access controls
-- Source of truth for what each user can see/do
-- Synced to Clerk publicMetadata on save
-- ============================================================

create table if not exists user_permissions (
  id              uuid primary key default gen_random_uuid(),
  clerk_user_id   text not null unique,
  email           text not null,
  full_name       text,
  role            text default 'viewer',  -- admin | gg_sales | master_agent | dealer | channel_partner | sub_dealer | rep | viewer
  org_id          uuid,  -- scoped dealer org if applicable

  -- Module access (what pages/sections they can see)
  can_see_crm              boolean default false,
  can_see_crm_all_orgs     boolean default false,  -- see ALL org data vs just their own
  can_see_maintenance      boolean default false,
  can_see_tech             boolean default false,
  can_see_products         boolean default false,
  can_see_quotes           boolean default false,
  can_see_billing          boolean default false,
  can_see_reps             boolean default false,
  can_see_compliance       boolean default false,
  can_see_reports          boolean default false,
  can_see_map              boolean default false,
  can_see_scorecard        boolean default false,
  can_see_directv          boolean default false,
  can_see_aria             boolean default false,
  can_see_cameras          boolean default false,
  can_see_access_control   boolean default false,
  can_see_network          boolean default false,
  can_see_admin            boolean default false,  -- admin panel (Russel only)
  can_see_dashboard        boolean default true,   -- main dashboard always visible

  -- Action permissions (all false by default — Russel controls these)
  can_create               boolean default false,
  can_edit                 boolean default false,  -- nobody gets this right now
  can_delete               boolean default false,  -- nobody gets this right now
  can_invite               boolean default false,  -- can invite other users

  -- Status
  is_active                boolean default true,
  invited_at               timestamptz default now(),
  last_seen_at             timestamptz,
  notes                    text,

  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);

create index if not exists idx_user_perms_clerk on user_permissions(clerk_user_id);
create index if not exists idx_user_perms_email on user_permissions(email);

-- Russel is always admin
insert into user_permissions (
  clerk_user_id, email, full_name, role,
  can_see_crm, can_see_crm_all_orgs, can_see_maintenance, can_see_tech,
  can_see_products, can_see_quotes, can_see_billing, can_see_reps,
  can_see_compliance, can_see_reports, can_see_map, can_see_scorecard,
  can_see_directv, can_see_aria, can_see_cameras, can_see_access_control,
  can_see_network, can_see_admin, can_create, can_edit, can_delete, can_invite
) values (
  'russel_admin', 'rfeldman@gateguard.co', 'Russel Feldman', 'admin',
  true, true, true, true, true, true, true, true,
  true, true, true, true, true, true, true, true,
  true, true, true, true, true, true
) on conflict (clerk_user_id) do nothing;

