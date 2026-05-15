-- ============================================================
-- GateGuard CRM — Pipeline Seed Data
-- Run THIS FILE in Supabase SQL editor AFTER 008_crm_full.sql
-- completes successfully.
--
-- Strategy:
--   1. Raw DDL (no DO blocks) to cast stage column + drop NOT NULL
--   2. Disable triggers so no side effects during bulk insert
--   3. Insert WITHOUT dealer_org_id (null allowed temporarily)
--   4. UPDATE all seed rows to set GateGuard org ID
--   5. Restore NOT NULL + re-enable triggers
-- ============================================================

-- ── Step 1: Cast stage column from old enum to text ──────────
-- Drop old default first (required when default is typed enum)
alter table opportunities alter column stage drop default;
alter table opportunities alter column stage type text using stage::text;
alter table opportunities alter column stage set default 'meet_present';

alter table opportunities alter column opp_type drop default;
alter table opportunities alter column opp_type type text using opp_type::text;
alter table opportunities alter column opp_type set default 'property';

alter table opportunities alter column forecast_cat drop default;
alter table opportunities alter column forecast_cat type text using forecast_cat::text;
alter table opportunities alter column forecast_cat set default 'pipeline';

-- ── Step 2: Allow null dealer_org_id for bulk insert ─────────
alter table opportunities alter column dealer_org_id drop not null;

-- ── Step 3: Insert pipeline seed data ────────────────────────
-- Skip if rows already exist (idempotent via name check)
insert into opportunities (
  name, stage, amount, probability, forecast_cat, close_date,
  account_name, management_co, site_contact_name,
  site_contact_phone, site_contact_title,
  owner_name, owner_initials, source,
  property_state, opp_type, description
)
select v.name, v.stage, v.amount, v.probability, v.forecast_cat, v.close_date::date,
       v.account_name, v.management_co, v.site_contact_name,
       v.site_contact_phone, v.site_contact_title,
       v.owner_name, v.owner_initials, v.source,
       v.property_state, v.opp_type, v.description
from (values
  -- ── MEET & PRESENT ──────────────────────────────────────────
  ('Grayson Park Estates — Your GateGuard',
   'meet_present', 100000, 20, 'pipeline', '2026-03-31',
   'Grayson Park Estates', 'Grayson Park Estates', null, null, 'Property Manager',
   'Russel Feldman', 'RF', 'direct', 'GA', 'property',
   'Full access control + camera system proposal'),

  ('General Proposal — Perennial Properties',
   'meet_present', 30000, 20, 'pipeline', '2026-04-30',
   'Perennial Properties', 'Perennial Properties', null, null, 'Property Manager',
   'Russel Feldman', 'RF', 'direct', 'GA', 'property',
   'General GateGuard platform proposal'),

  ('The Hamilton — Your GateGuard',
   'meet_present', 100000, 20, 'pipeline', '2026-04-30',
   'The Hamilton', 'The Hamilton', null, null, 'Property Manager',
   'Russel Feldman', 'RF', 'direct', 'GA', 'property',
   'Access control + gate system'),

  -- ── PROPOSE ─────────────────────────────────────────────────
  ('Avondale Hills by Elevate — Your GateGuard',
   'propose', 144141.20, 50, 'pipeline', '2026-03-31',
   'Avondale Hills by Elevate', 'Avondale Hills by Elevate', 'Tori Knowles',
   '678.712.5500', 'Property Manager',
   'Russel Feldman', 'RF', 'direct', 'GA', 'property',
   'Full gate, intercom, camera and access system — Elevate model'),

  ('Barrington Hills — Your GateGuard',
   'propose', 100000, 50, 'pipeline', '2026-04-10',
   'Barrington Hills', 'Barrington Hills', null, null, 'Property Manager',
   'Russel Feldman', 'RF', 'direct', 'GA', 'property',
   'Complete GateGuard platform installation'),

  ('Columbia Crest — Your GateGuard',
   'propose', 150000, 50, 'pipeline', '2026-01-31',
   'Columbia Crest', 'Columbia Crest', null, null, 'Property Manager',
   'Russel Feldman', 'RF', 'direct', 'GA', 'property',
   'Full access + surveillance system'),

  ('Columbia Gardens at South City — Your GateGuard',
   'propose', 150000, 50, 'pipeline', '2026-01-31',
   'Columbia Gardens at South City', 'Columbia Gardens', null, null, 'Property Manager',
   'Russel Feldman', 'RF', 'direct', 'GA', 'property',
   'GateGuard platform + camera expansion'),

  ('GateGuard Addendum — Columbia Residential',
   'propose', 801, 50, 'pipeline', '2026-04-15',
   'Columbia Residential', 'Columbia Residential', null, null, 'Property Manager',
   'Russel Feldman', 'RF', 'direct', 'GA', 'property',
   'Add-on services to existing install'),

  ('Midwood Gardens — Camera Expansion',
   'propose', 45000, 50, 'pipeline', '2026-05-01',
   'Midwood Gardens', 'Midwood Gardens Mgmt', null, null, 'Property Manager',
   'Russel Feldman', 'RF', 'direct', 'GA', 'property',
   'Camera expansion + gate upgrade'),

  ('Parkview Estates — Full Platform',
   'propose', 120000, 50, 'pipeline', '2026-04-20',
   'Parkview Estates', 'Parkview Management', null, null, 'Property Manager',
   'Russel Feldman', 'RF', 'direct', 'GA', 'property',
   'Full GateGuard platform + Elevate MRR model'),

  -- ── NEGOTIATE ───────────────────────────────────────────────
  ('Your GateGuard — 1401 West Paces Ferry',
   'negotiate', 80000, 75, 'best_case', '2026-04-30',
   '1401 West Paces Ferry', 'West Paces Properties', null, null, 'Property Manager',
   'Russel Feldman', 'RF', 'direct', 'GA', 'property',
   'Gate system + camera installation — in contract negotiation'),

  ('Camera System — 92 West Paces',
   'negotiate', 30000, 75, 'best_case', '2026-04-10',
   '92W. Paces', '92 West Paces LLC', null, null, 'Property Manager',
   'Russel Feldman', 'RF', 'direct', 'GA', 'property',
   'Camera-only scope'),

  ('Adamsville Green — Cameras',
   'negotiate', 20000, 75, 'best_case', '2026-01-31',
   'Adamsville Green', 'Adamsville Green Mgmt', null, null, 'Property Manager',
   'Russel Feldman', 'RF', 'direct', 'GA', 'property',
   'Camera system upgrade'),

  ('2026 Your GateGuard for Artesian East Village',
   'negotiate', 150000, 75, 'best_case', '2026-01-31',
   'Artesian East Village', 'Artesian Communities', null, null, 'Property Manager',
   'Russel Feldman', 'RF', 'direct', 'GA', 'property',
   'Full GateGuard platform for new development'),

  ('Camera & Gate Proposal — Avana Chase',
   'negotiate', 20000, 75, 'best_case', '2026-03-31',
   'Avana Chase', 'Avana Properties', null, null, 'Property Manager',
   'Russel Feldman', 'RF', 'direct', 'GA', 'property',
   'Camera and gate proposal under negotiation'),

  ('Mitul Patel — Camera System',
   'negotiate', 15000, 75, 'best_case', '2026-04-15',
   'Mitul Patel', null, 'Mitul Patel', null, 'Owner',
   'Russel Feldman', 'RF', 'referral', 'GA', 'property',
   'Residential/boutique property camera system'),

  -- ── CLOSED WON ──────────────────────────────────────────────
  ('Your GateGuard — The Villages on Riverwalk',
   'won', 175000, 100, 'closed', '2026-03-19',
   'The Villages on Riverwalk', 'Riverwalk Properties', null, null, 'Property Manager',
   'Russel Feldman', 'RF', 'direct', 'GA', 'property',
   'Complete GateGuard installation — CLOSED'),

  ('Gardens at Camp Creek — Cameras',
   'won', 61830, 100, 'closed', '2026-02-27',
   'Radco', 'Radco Management', null, null, 'Regional Manager',
   'Nicole Gagliardi', 'NG', 'direct', 'GA', 'property',
   'Camera system — CLOSED'),

  ('Aster Buckhead — Gate Service',
   'won', 5030, 100, 'closed', '2026-02-27',
   'Radco', 'Radco Management', null, null, 'Regional Manager',
   'Russel Feldman', 'RF', 'direct', 'GA', 'property',
   'Gate service agreement — CLOSED'),

  ('Rhythm at Riverdale — Network Bridge',
   'won', 5000, 100, 'closed', '2026-03-10',
   'Rhythm at Riverdale', 'Rhythm Management', null, null, 'Property Manager',
   'Russel Feldman', 'RF', 'direct', 'GA', 'property',
   'Network bridge installation — CLOSED'),

  ('Add 2x 2-Way Audio Cameras — Mitul Patel',
   'won', 3000, 100, 'closed', '2026-03-19',
   'Mitul Patel', null, 'Mitul Patel', null, 'Owner',
   'Russel Feldman', 'RF', 'referral', 'GA', 'property',
   'Audio camera add-on — CLOSED')

) as v(name, stage, amount, probability, forecast_cat, close_date,
       account_name, management_co, site_contact_name, site_contact_phone, site_contact_title,
       owner_name, owner_initials, source, property_state, opp_type, description)
where not exists (
  select 1 from opportunities o where o.name = v.name
);

-- ── Step 5: Set dealer_org_id on all seed rows ────────────────
update opportunities
set dealer_org_id = '00000000-0000-0000-0000-000000000001'
where dealer_org_id is null;

-- ── Step 6: Restore NOT NULL ──────────────────────────────────
alter table opportunities alter column dealer_org_id set not null;

-- ── Step 7: Stage history for closed won deals ────────────────
insert into opportunity_stage_history
  (opportunity_id, stage, amount, probability, changed_by_name, changed_at)
select id, 'meet_present',   amount * 0.80, 20,  owner_name, created_at + interval '1 day'
  from opportunities where stage = 'won' and name like '%Villages%'
union all
select id, 'survey_request', amount * 0.85, 30,  owner_name, created_at + interval '7 days'
  from opportunities where stage = 'won' and name like '%Villages%'
union all
select id, 'propose',        amount * 0.90, 50,  owner_name, created_at + interval '21 days'
  from opportunities where stage = 'won' and name like '%Villages%'
union all
select id, 'negotiate',      amount,        75,  owner_name, created_at + interval '35 days'
  from opportunities where stage = 'won' and name like '%Villages%'
union all
select id, 'won',            amount,        100, owner_name, won_at
  from opportunities where stage = 'won' and name like '%Villages%';

-- ── Done ──────────────────────────────────────────────────────
-- Verify:
-- select stage, count(*), sum(amount) from opportunities group by stage;
