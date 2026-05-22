-- Migration 070: Service Catalog
-- Multifamily recurring services marketplace — dealers can enroll and quote any service

create table if not exists service_catalog (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  provider        text not null,
  category        text not null check (category in (
    'tv','internet','video_monitoring','package_lockers',
    'access_control','smart_locks','security','network_mgmt','energy','other'
  )),
  description     text,
  logo_emoji      text default '📦',
  provider_color  text default '#6B7EFF',   -- hex for UI theming
  billing_type    text not null default 'per_unit' check (billing_type in ('per_unit','per_property','flat_fee')),
  base_price      numeric(10,2) not null,   -- $ per unit/property/flat depending on billing_type
  unit_label      text default 'unit',      -- e.g. "unit", "door", "camera", "property"
  min_units       integer default 1,
  contract_months integer default 12,
  dealer_commission_pct  numeric(5,2) default 10.00,  -- % of revenue dealer earns
  gg_commission_pct      numeric(5,2) default 5.00,   -- % GateGuard earns as platform fee
  is_active       boolean default true,
  is_featured     boolean default false,
  requires_enrollment boolean default false,         -- dealer must apply/enroll first
  enrollment_url  text,                              -- external enrollment link
  learn_more_url  text,
  notes           text,
  sort_order      integer default 100,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Dealer enrollments — tracks which dealers are certified/active with each service
create table if not exists dealer_service_enrollments (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references organizations(id) on delete cascade,
  service_id      uuid references service_catalog(id) on delete cascade,
  status          text default 'pending' check (status in ('pending','active','suspended','inactive')),
  enrolled_at     timestamptz default now(),
  activated_at    timestamptz,
  dealer_code     text,    -- provider-specific dealer/rep code
  notes           text,
  created_at      timestamptz default now(),
  unique (org_id, service_id)
);

-- Properties enrolled in a service — for MRR tracking
create table if not exists site_service_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid references sites(id) on delete cascade,
  service_id      uuid references service_catalog(id) on delete cascade,
  org_id          uuid references organizations(id),
  units           integer default 1,
  monthly_amount  numeric(10,2),
  status          text default 'active' check (status in ('active','pending','cancelled','paused')),
  start_date      date,
  end_date        date,
  contract_months integer default 12,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- RLS
alter table service_catalog              enable row level security;
alter table dealer_service_enrollments   enable row level security;
alter table site_service_subscriptions   enable row level security;

create policy "service_role_all" on service_catalog              for all to service_role using (true) with check (true);
create policy "service_role_all" on dealer_service_enrollments   for all to service_role using (true) with check (true);
create policy "service_role_all" on site_service_subscriptions   for all to service_role using (true) with check (true);

-- Read-only for authenticated users
create policy "authenticated_read_catalog" on service_catalog for select to authenticated using (is_active = true);

-- ── Seed catalog ────────────────────────────────────────────────────────────────

insert into service_catalog (name, provider, category, description, logo_emoji, provider_color, billing_type, base_price, unit_label, min_units, contract_months, dealer_commission_pct, gg_commission_pct, is_featured, sort_order, notes) values

-- TV / Entertainment
('DIRECTV STREAM Bulk',       'AT&T DIRECTV',      'tv',             'Bulk MDU bulk video — 190+ channels, 4K HDR, no satellite dish required. Revenue share per activated unit.', '📺', '#00A8E0', 'per_unit',     12.00,  'unit',    20, 24, 12.00, 3.00, true,  10, 'Requires AT&T MDU dealer certification. Contact ATLAS for onboarding.'),
('DIRECTV via Satellite',     'AT&T DIRECTV',      'tv',             'Traditional bulk satellite MDU agreement. Best for properties without reliable internet.', '🛰️', '#00A8E0', 'per_unit',     9.00,   'unit',    50, 24, 10.00, 3.00, false, 11, 'Min 50 units. Satellite dish install required.'),
('Spectrum TV Select',        'Spectrum Enterprise','tv',             'Charter/Spectrum bulk TV agreement — MDU rate card. Local market availability varies.', '📡', '#0099D9', 'per_unit',     11.00,  'unit',    30, 24, 8.00,  2.50, false, 12, 'Check market availability before quoting.'),

-- Internet / ISP
('AT&T Fiber Bulk MDU',       'AT&T',              'internet',       'Gigabit fiber internet for MDU properties. Included in rent option available. Resident-facing speed tiers.', '🌐', '#00A8E0', 'per_unit',     18.00,  'unit',    20, 36, 10.00, 3.00, true,  20, 'Fiber availability map required before quote. 36-month agreement standard.'),
('Comcast Business MDU',      'Comcast/Xfinity',   'internet',       'Xfinity bulk internet for MDU. Up to 1.2 Gbps. Included-in-rent or tiered upgrade packages.', '📶', '#E1251B', 'per_unit',     15.00,  'unit',    20, 24, 8.00,  2.50, false, 21, NULL),
('Starlink for MDU',          'SpaceX Starlink',   'internet',       'Satellite broadband where fiber is unavailable. $500 hardware one-time + monthly service.', '🚀', '#FF5733', 'per_property', 500.00, 'property', 1, 12, 5.00,  2.00, false, 22, 'Best for rural/suburban properties without fiber options.'),

-- Video Monitoring
('Video Monitoring — Remote', 'Keystone Security', 'video_monitoring','24/7 live video monitoring with human response. Alarm verification, virtual guard tours, deterrence alerts.', '👁️', '#7C3AED', 'per_property', 395.00, 'property', 1, 12, 15.00, 5.00, true,  30, 'GateGuard installs Eagle Eye cameras. Keystone monitors. Clean handoff.'),
('Video Monitoring — AI',     'Envision AI',       'video_monitoring','AI-powered video analytics — loitering detection, license plate recognition, crowd alerts. No human monitoring.', '🤖', '#6B7EFF', 'per_camera',   18.00,  'camera',  4, 12, 12.00, 4.00, false, 31, 'Requires Eagle Eye cameras already installed.'),
('Virtual Guard Tour',        'Securitas Digital', 'video_monitoring','Scheduled virtual patrol tours via existing cameras. Incident reporting included.', '🔒', '#1E293B', 'per_property', 250.00, 'property', 1, 12, 10.00, 3.00, false, 32, NULL),

-- Package Lockers
('Package Lockers — Standard','Luxer One',         'package_lockers','Smart locker system — residents get PIN/app notification on delivery. Reduces stolen packages 95%+.', '📦', '#FF6B35', 'flat_fee',    149.00, 'property', 1, 36, 20.00, 5.00, true,  40, 'Hardware sold separately. SaaS fee shown. Min 4-door unit for < 100 units.'),
('Amazon Hub Apartment',      'Amazon',            'package_lockers','Amazon-branded locker — Amazon covers hardware cost, property gets revenue share on deliveries.', '📬', '#FF9900', 'flat_fee',      0.00,  'property', 1, 36, 0.00,  2.00, false, 41, 'Amazon pays dealer a referral fee at install. No monthly SaaS cost to property.'),
('Package Concierge',         'Package Concierge', 'package_lockers','Full-service package room management — smart locker + attendant option.', '🏢', '#0F4C81', 'flat_fee',    199.00, 'property', 1, 24, 15.00, 4.00, false, 42, NULL),

-- Access Control (GateGuard Own + Others)
('GateGuard Access + Gate Plan','GateGuard',       'access_control', 'GateGuard signature plan — gate operators, Brivo cloud access, mobile credentials, 24/7 monitoring, all-inclusive service. $5/unit/month.', '🔑', '#6B7EFF', 'per_unit',     5.00,   'unit',    1, 36, 0.00,  100.00, true, 50, 'This is GateGuard core product. 100% revenue to GateGuard — dealer earns on install margin.'),
('Brivo Cloud Access Control','Brivo',             'access_control', 'Brivo ACS cloud subscription — $3/door/month. Doors, readers, credentials managed in Brivo portal.', '🚪', '#0069C0', 'per_unit',     3.00,   'door',    1, 12, 8.00,  2.00, false, 51, 'Dealer must be Brivo certified. GateGuard assists with onboarding.'),
('LiftMaster myQ Access',     'Chamberlain',       'access_control', 'myQ commercial cloud access — gate operators + cloud management platform.', '🏠', '#E31837', 'per_unit',     2.50,   'unit',    1, 12, 6.00,  1.50, false, 52, NULL),

-- Smart Locks
('Yale Smart Locks — Zwave',  'Yale',              'smart_locks',    'Z-wave smart deadbolts with cloud management. Integrates with Brivo for keyless resident access.', '🔐', '#003DA5', 'flat_fee',     12.00,  'door',    10, 24, 18.00, 4.00, true,  60, 'Yale Approach or Yale Assure series. Requires Z-wave hub or Brivo integration.'),
('Schlage Encode Plus',       'Schlage',           'smart_locks',    'Apple Home Key + WiFi deadbolt. Best for properties with Apple ecosystem residents.', '🗝️', '#1C3D5A', 'flat_fee',     10.00,  'door',    10, 24, 15.00, 3.50, false, 61, NULL),
('Latch M',                   'Latch',             'smart_locks',    'Latch M smart lock — resident app, keycard, touchscreen entry. Subscription includes cloud management.', '📱', '#00D4AA', 'per_unit',     6.00,   'door',    20, 24, 10.00, 3.00, false, 62, 'Note: Latch financials under stress — verify contract terms carefully.'),

-- Security
('ADT Commercial Security',   'ADT',               'security',       'ADT commercial intrusion, fire alarm, and video integration. Central station monitoring included.', '🛡️', '#0066FF', 'per_property', 89.00,  'property', 1, 36, 12.00, 3.00, false, 70, 'Requires ADT commercial dealer agreement. Separate from ADT residential.'),
('Verkada Access + Security', 'Verkada',           'security',       'Cloud-managed security cameras, access control, and alarms on one platform.', '📷', '#1A1A2E', 'per_device',   20.00,  'device',  5, 12, 10.00, 3.00, false, 71, 'Verkada is all-in-one but camera hardware is expensive. Position as premium tier.'),

-- Network Management
('GateGuard Network Mgmt',    'GateGuard',         'network_mgmt',   'Managed UniFi network for leasing offices and common areas. Monthly health monitoring, firmware updates, 4-hour response SLA.', '🌐', '#6B7EFF', 'per_property', 199.00, 'property', 1, 12, 0.00, 80.00, true, 80, 'GateGuard-managed service. Dealer earns on hardware margin at install.'),
('Comcast Business Ethernet', 'Comcast Business',  'network_mgmt',   'Dedicated fiber Ethernet for leasing office — 99.9% SLA, static IP, 24/7 NOC support.', '🔌', '#E1251B', 'per_property', 299.00, 'property', 1, 36, 8.00,  2.00, false, 81, 'Best for properties needing guaranteed uptime for gate/access systems.'),

-- Energy
('Solstice Energy Sharing',   'Solstice Power',    'energy',         'Community solar subscription — residents get 10-15% off electricity, property earns referral income.', '☀️', '#F59E0B', 'per_unit',     2.00,   'unit',    50, 12, 8.00,  2.00, false, 90, 'No hardware install required. Residents opt in individually.')

on conflict do nothing;
