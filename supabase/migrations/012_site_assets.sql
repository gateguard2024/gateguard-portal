-- ============================================================
-- GateGuard OS — Migration 012: Site Assets + Hierarchy Fix
--
-- Part 1: Correct the org hierarchy from the legacy MSO model
--         to the real GateGuard 6-tier structure:
--
--   corporate → master_agent → master_dealer
--                                  ↓
--                         sales / install_dealer / service_dealer
--                                  ↓
--                               client
--
-- Part 2: site_assets — every piece of equipment installed at
--         a property, with full dealer attribution (who owns,
--         who installed, who services).
--
-- Part 3: site_asset_terminals — terminal-level wiring map for
--         each installed device. The "as-built" record that
--         makes the /tech tool know the exact site before arrival.
-- ============================================================

-- ============================================================
-- PART 1 — Org hierarchy correction
-- ============================================================

-- Add new tier values to the enum (additive, never drops old values
-- so existing data is not broken)
do $$ begin
  alter type org_tier add value if not exists 'master_agent';
exception when others then null; end $$;

do $$ begin
  alter type org_tier add value if not exists 'master_dealer';
exception when others then null; end $$;

do $$ begin
  alter type org_tier add value if not exists 'sales';
exception when others then null; end $$;

do $$ begin
  alter type org_tier add value if not exists 'install_dealer';
exception when others then null; end $$;

do $$ begin
  alter type org_tier add value if not exists 'service_dealer';
exception when others then null; end $$;

-- Add a human-readable tier_label column so the UI doesn't need
-- to translate enum values
alter table organizations
  add column if not exists tier_label text,
  add column if not exists license_number text,
  add column if not exists service_area_states text[],  -- e.g. ['GA', 'FL', 'SC']
  add column if not exists tech_count integer default 0,
  add column if not exists onboarded_at timestamptz;

-- Back-fill tier_label for any existing rows
update organizations set tier_label = case tier
  when 'corporate'    then 'GateGuard Corporate'
  when 'mso'          then 'Master Agent'          -- remap legacy MSO → Master Agent
  when 'dealer'       then 'Master Dealer'          -- remap legacy dealer → Master Dealer
  when 'partner'      then 'Install / Service Dealer'
  when 'client'       then 'Client (Property)'
  else tier::text
end
where tier_label is null;

-- ============================================================
-- PART 2 — Sites (property records, independent of CRM)
-- ============================================================
-- A "site" is a physical property where GateGuard equipment is
-- installed. It may or may not have a corresponding CRM record.
-- Separating it from the CRM allows sites to exist before a
-- deal is closed (e.g. a demo install) and to persist after
-- the CRM opportunity is archived.

create table if not exists sites (
  id               uuid primary key default gen_random_uuid(),

  -- Org ownership
  org_id           uuid references organizations(id) on delete cascade,   -- owning org (master dealer)
  master_dealer_id uuid references organizations(id) on delete set null,  -- explicit master dealer
  install_dealer_id uuid references organizations(id) on delete set null, -- who installed
  service_dealer_id uuid references organizations(id) on delete set null, -- who services

  -- Property identity
  name             text not null,           -- "Stonegate Townhomes"
  address          text,
  city             text,
  state            text,
  zip              text,
  property_type    text default 'Multifamily', -- Multifamily | HOA | Commercial | Mixed-Use | Other
  units            integer,

  -- CRM linkage (optional — populated when a CRM customer/opp exists)
  crm_customer_id  uuid,                   -- FK to customers table (when built)
  crm_opp_id       uuid,                   -- FK to opportunities table

  -- Site status
  status           text not null default 'active',  -- active | inactive | prospect | churned

  -- Contacts
  primary_contact_name  text,
  primary_contact_email text,
  primary_contact_phone text,
  pm_name               text,   -- Property manager name (may differ from primary contact)
  pm_email              text,
  pm_phone              text,

  -- Access info (stored securely for tech use)
  gate_code         text,
  parking_notes     text,
  access_notes      text,        -- "Check in at leasing office before entering"

  -- Metadata
  notes             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create index if not exists idx_sites_org      on sites(org_id);
create index if not exists idx_sites_dealer   on sites(master_dealer_id);
create index if not exists idx_sites_service  on sites(service_dealer_id);
create index if not exists idx_sites_status   on sites(status);

-- ============================================================
-- PART 3 — Site Assets (installed equipment per site)
-- ============================================================

create table if not exists site_assets (
  id               uuid primary key default gen_random_uuid(),
  site_id          uuid not null references sites(id) on delete cascade,
  org_id           uuid references organizations(id) on delete cascade,

  -- What's installed
  product_id       uuid references products(id) on delete set null,
  product_name     text not null,           -- denormalized: "DoorKing 1601"
  product_sku      text,                    -- denormalized: "DK-1601-AC"
  product_category text,                   -- "Gate Operator" | "Access Controller" | "Camera" | "Network" | etc.

  -- Physical identity
  serial_number    text,
  mac_address      text,                   -- networked devices
  ip_address       text,                   -- networked devices (VLAN-relative)
  firmware_version text,

  -- Location within site
  location_note    text not null default 'Main Gate',
  -- e.g. "Main Vehicle Gate", "Pool Gate", "Lobby Door", "Server Room", "Pedestrian Gate North"
  location_zone    text,                   -- free-form zone grouping for multi-gate sites

  -- Install record
  work_order_id    uuid references work_orders(id) on delete set null,
  installed_by     text,                   -- tech name
  installed_at     timestamptz,
  install_notes    text,

  -- Status + health
  status           text not null default 'active',
  -- active | offline | degraded | replaced | removed
  last_seen_at     timestamptz,            -- populated by health monitoring
  offline_since    timestamptz,

  -- Notes
  notes            text,

  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists idx_site_assets_site    on site_assets(site_id);
create index if not exists idx_site_assets_product on site_assets(product_id);
create index if not exists idx_site_assets_status  on site_assets(status);
create index if not exists idx_site_assets_org     on site_assets(org_id);

-- ============================================================
-- PART 4 — Site Asset Terminals (terminal-level wiring map)
-- ============================================================
-- This is what makes the /tech tool truly powerful.
-- One row per terminal on each installed device.
-- Pre-populated from device_suggestions when an asset is added;
-- verified/corrected by the tech during or after install.

create table if not exists site_asset_terminals (
  id                    uuid primary key default gen_random_uuid(),
  site_asset_id         uuid not null references site_assets(id) on delete cascade,

  -- Terminal identity (matches device_suggestions terminal definitions)
  terminal_id           text not null,
  -- Physical ID: "T1", "T4", "COM", "NO", "J2-1", "GND", "PWR+"
  terminal_label        text,
  -- Human label: "Gate Relay NO", "AC Hot", "Loop Detector In", "RS-485 A"
  terminal_function     text,
  -- Semantic function: gate_relay_no | gate_relay_com | gate_relay_nc |
  --   power_12v | power_24v | power_ac | power_gnd |
  --   loop_detector | photobeam | exit_wand |
  --   rs485_a | rs485_b | wiegand_d0 | wiegand_d1 |
  --   ethernet | relay_trigger | alarm_output |
  --   intercom_audio | intercom_video | open_collector

  -- What this terminal connects TO
  connected_to_asset_id    uuid references site_assets(id) on delete set null,
  connected_to_terminal    text,    -- terminal_id on the other device
  connected_to_label       text,    -- human label for quick reading

  -- Physical wire details
  wire_color               text,    -- "red" | "black" | "white" | "green" | "white/green" | etc.
  cable_type               text,    -- "18/2" | "18/4" | "CAT5e" | "CAT6" | "14/2" | "22/2 shielded" | "fiber"
  cable_run_ft             integer, -- measured run length in feet
  conduit                  boolean default false,
  conduit_notes            text,

  -- Verification status
  -- "unverified"  = pre-populated from product library, not confirmed in field
  -- "verified"    = tech physically confirmed this connection
  -- "corrected"   = tech found it wrong and fixed it
  -- "open"        = terminal exists but is not connected (intentionally)
  verification_status      text not null default 'unverified',
  verified_at              timestamptz,
  verified_by              text,    -- tech name

  notes                    text,
  created_at               timestamptz default now()
);

create index if not exists idx_sat_asset    on site_asset_terminals(site_asset_id);
create index if not exists idx_sat_function on site_asset_terminals(terminal_function);
create index if not exists idx_sat_connected on site_asset_terminals(connected_to_asset_id);

-- ============================================================
-- PART 5 — Site Events log (health + activity timeline)
-- ============================================================
-- Every significant event at a site: install, service call,
-- device offline, firmware update, gate cycle anomaly, etc.
-- Feeds the property intelligence card on the dashboard.

create table if not exists site_events (
  id           uuid primary key default gen_random_uuid(),
  site_id      uuid not null references sites(id) on delete cascade,
  asset_id     uuid references site_assets(id) on delete set null,
  event_type   text not null,
  -- install | service_call | device_offline | device_online | firmware_update
  -- gate_fault | camera_offline | access_denied_surge | work_order_created | work_order_completed
  event_source text default 'manual',  -- manual | auto | brivo | eagle_eye | unifi
  summary      text,
  metadata     jsonb,                  -- flexible per-event-type payload
  severity     text default 'info',    -- info | warning | critical
  created_at   timestamptz default now()
);

create index if not exists idx_site_events_site on site_events(site_id, created_at desc);
create index if not exists idx_site_events_type on site_events(event_type);

-- ============================================================
-- RLS (all tables protected, service role bypasses)
-- ============================================================

alter table sites                enable row level security;
alter table site_assets          enable row level security;
alter table site_asset_terminals enable row level security;
alter table site_events          enable row level security;

drop policy if exists "service_role_sites"     on sites;
drop policy if exists "service_role_assets"    on site_assets;
drop policy if exists "service_role_terminals" on site_asset_terminals;
drop policy if exists "service_role_events"    on site_events;

create policy "service_role_sites"     on sites                for all using (true);
create policy "service_role_assets"    on site_assets          for all using (true);
create policy "service_role_terminals" on site_asset_terminals for all using (true);
create policy "service_role_events"    on site_events          for all using (true);

-- ============================================================
-- updated_at triggers
-- ============================================================

drop trigger if exists trg_sites_updated       on sites;
drop trigger if exists trg_site_assets_updated on site_assets;

create trigger trg_sites_updated
  before update on sites
  for each row execute function set_updated_at();

create trigger trg_site_assets_updated
  before update on site_assets
  for each row execute function set_updated_at();

-- ============================================================
-- Link work_orders → site
-- ============================================================
-- Add site_id to work_orders so dispatch knows which site a job
-- is at (separate from the free-text customer_name field)

alter table work_orders
  add column if not exists site_id uuid references sites(id) on delete set null;

create index if not exists idx_wo_site on work_orders(site_id);

-- ============================================================
-- Seed one demo site so the UI has something to show
-- ============================================================

insert into sites (
  id, name, address, city, state, zip,
  property_type, units, status,
  primary_contact_name, primary_contact_email,
  pm_name, gate_code, access_notes
) values (
  '00000000-0000-0000-0001-000000000001',
  'Stonegate Townhomes',
  '1400 Stonegate Dr', 'Alpharetta', 'GA', '30022',
  'Multifamily', 186, 'active',
  'Maria Alvarez', 'malvarez@stonegateapts.com',
  'Maria Alvarez', '#4521',
  'Check in at leasing office before accessing server room'
) on conflict (id) do nothing;
