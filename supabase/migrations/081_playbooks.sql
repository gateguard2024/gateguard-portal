-- ─── Migration 081: Playbooks ─────────────────────────────────────────────────
-- Two types: site_job (deployment/field checklists) + dev_rd (engineering lifecycle)

-- Playbook templates (system + custom)
create table if not exists playbook_templates (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations(id) on delete cascade,
  type        text not null check (type in ('site_job', 'dev_rd')),
  name        text not null,
  description text,
  category    text,
  steps       jsonb default '[]'::jsonb,
  is_system   boolean default false,
  created_at  timestamptz default now()
);

-- Active playbook runs
create table if not exists playbook_runs (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid references organizations(id) on delete cascade,
  template_id  uuid references playbook_templates(id),
  type         text not null check (type in ('site_job', 'dev_rd')),
  name         text not null,
  site_id      uuid references sites(id),
  project_name text,
  project_repo text,
  phase        text check (phase in ('r_and_d', 'alpha', 'beta', 'production')),
  status       text not null default 'active' check (status in ('active', 'completed', 'paused', 'cancelled')),
  assignee     text,
  due_date     date,
  completed_at timestamptz,
  step_progress jsonb default '{}'::jsonb,
  notes        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists playbook_runs_org_idx  on playbook_runs(org_id);
create index if not exists playbook_runs_type_idx on playbook_runs(type);

-- RLS
alter table playbook_templates enable row level security;
drop policy if exists "service_role_all" on playbook_templates;
create policy "service_role_all" on playbook_templates using (true) with check (true);

alter table playbook_runs enable row level security;
drop policy if exists "service_role_all" on playbook_runs;
create policy "service_role_all" on playbook_runs using (true) with check (true);

-- ─── Seed system templates ────────────────────────────────────────────────────
insert into playbook_templates (id, org_id, type, name, description, category, is_system, steps) values

-- Site/Job: New Site Pre-Launch
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'site_job',
 'New Site Pre-Launch',
 'Full pre-launch checklist before a new property goes live',
 'Pre-Launch', true,
'[
  {"id":"s1","title":"Run Supabase migrations on beta","description":"Confirm all pending migrations are applied and smoke-tested on beta Supabase project","required":true},
  {"id":"s2","title":"Verify Vercel env vars","description":"Check all required env vars are set in Vercel project (SUPABASE, CLERK, ANTHROPIC, MAPBOX, etc.)","required":true},
  {"id":"s3","title":"Smoke test all portal flows","description":"Test login, WO creation, camera feed, access control, and tech tool PIN","required":true},
  {"id":"s4","title":"Configure site in portal","description":"Create site record, assign org, set billing rates (video fee + per-unit rate)","required":true},
  {"id":"s5","title":"Send PM portal invite","description":"Create client user in Clerk with client role, send welcome email via /api/admin/dealers/send-docs","required":true},
  {"id":"s6","title":"Deliver as-built documentation","description":"Upload final as-built PDF to site record in /design/as-builts","required":false},
  {"id":"s7","title":"Schedule 30-day follow-up","description":"Add follow-up To-Do in /eos for 30 days post-launch","required":false}
]'::jsonb),

-- Site/Job: Hardware Upgrade
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'site_job',
 'Hardware Upgrade',
 'End-to-end checklist for a hardware upgrade or expansion at an existing property',
 'Hardware', true,
'[
  {"id":"h1","title":"Site survey complete","description":"Use /tech Site Survey to inventory all existing devices and document conditions","required":true},
  {"id":"h2","title":"Parts ordered and confirmed","description":"Verify all required parts are in inventory or PO is created","required":true},
  {"id":"h3","title":"PM notified of install window","description":"Send outage/access notice to property manager at least 48 hours in advance","required":true},
  {"id":"h4","title":"Install day checklist complete","description":"All new devices powered, wired, and tested per wiring guide","required":true},
  {"id":"h5","title":"Brivo and UniFi updated","description":"New devices registered in Brivo ACS and UniFi network","required":true},
  {"id":"h6","title":"Camera feeds verified","description":"All camera feeds visible in Eagle Eye dashboard","required":false},
  {"id":"h7","title":"As-built updated","description":"Floor plan and as-built docs updated in /design to reflect new devices","required":true},
  {"id":"h8","title":"WO marked completed","description":"Close work order, attach photos, capture tech resolution note","required":true}
]'::jsonb),

-- Site/Job: New Dealer Onboarding
('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'site_job',
 'New Dealer Onboarding',
 'Complete dealer setup from signed agreement to first login',
 'Onboarding', true,
'[
  {"id":"d1","title":"Create org in portal","description":"Set org tier, commission config, and parent org in /admin/dealers/new","required":true},
  {"id":"d2","title":"Send NDA + Agreement","description":"Auto-send via /api/admin/dealers/send-docs — tier determines which NDA version","required":true},
  {"id":"d3","title":"Confirm docs signed","description":"Verify e-sign completion via /design/esign before granting portal access","required":true},
  {"id":"d4","title":"Create Clerk account","description":"Invite dealer to portal with dealer role scoped to their org","required":true},
  {"id":"d5","title":"Send welcome email with tech tool code","description":"Include TECH_ACCESS_CODE, /tech URL, and training course links","required":true},
  {"id":"d6","title":"Schedule onboarding L10 call","description":"Book 1-hour walkthrough call within 5 business days of go-live","required":false}
]'::jsonb),

-- Site/Job: Recurring PM Visit
('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'site_job',
 'Recurring PM Visit',
 'Quarterly preventive maintenance checklist for installed properties',
 'Maintenance', true,
'[
  {"id":"pm1","title":"Gate cycle test","description":"Run 20 full open/close cycles, check for noise, hesitation, or limit switch drift","required":true},
  {"id":"pm2","title":"Safety device test","description":"Test all photobeams, loop detectors, and edge sensors for proper function","required":true},
  {"id":"pm3","title":"Camera health check","description":"Verify all Eagle Eye feeds are online and PTZ controls respond","required":true},
  {"id":"pm4","title":"Brivo credential audit","description":"Confirm no orphaned credentials; check access log for anomalies","required":true},
  {"id":"pm5","title":"UniFi network health","description":"Check uptime, check for offline APs or switches in UniFi dashboard","required":true},
  {"id":"pm6","title":"Firmware updates","description":"Apply pending firmware to gate operator, Brivo panels, UniFi devices","required":false},
  {"id":"pm7","title":"Lubricate mechanical components","description":"Grease chain, hinges, rollers, and arm pivot per operator spec","required":true},
  {"id":"pm8","title":"Photo documentation","description":"Capture before/after photos, attach to WO in portal","required":false},
  {"id":"pm9","title":"PM report sent to property manager","description":"Send summary email with findings and any recommended follow-up work","required":true}
]'::jsonb),

-- Dev/R&D: New App Feature Sprint
('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'dev_rd',
 'New App Feature Sprint',
 'Standard dev lifecycle for any new portal or gatecard.co feature',
 'Portal', true,
'[
  {"id":"f1","title":"Add to CLAUDE.md context","description":"Document the feature intent, file locations, and API routes in the relevant CLAUDE.md","required":true},
  {"id":"f2","title":"Write Supabase migration","description":"Schema changes, RLS policies, seed data — numbered sequentially after last migration","required":true},
  {"id":"f3","title":"Build API routes","description":"GET, POST, PATCH, DELETE with Clerk auth or x-tech-code as appropriate","required":true},
  {"id":"f4","title":"Build UI page/component","description":"Follow portal design system: DataTable, SlideOver, EmptyState, SkeletonRow","required":true},
  {"id":"f5","title":"Add to Sidebar nav","description":"Wire route in components/layout/Sidebar.tsx under correct section","required":true},
  {"id":"f6","title":"Test on beta branch","description":"Verify against beta Supabase project — run migration on beta first","required":true},
  {"id":"f7","title":"Update CLAUDE.md What is Live section","description":"Document what was built, what files changed, for future Claude sessions","required":true},
  {"id":"f8","title":"Push to main and verify on live","description":"Final git push, Vercel deploy, smoke test on production","required":true}
]'::jsonb),

-- Dev/R&D: New Site Platform Build (gatecard.co)
('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'dev_rd',
 'New Site Platform Build (gatecard.co)',
 'Full lifecycle for deploying a new multifamily property on gatecard.co',
 'Site Platform', true,
'[
  {"id":"g1","title":"Site survey complete","description":"All devices inventoried via /tech Site Survey, as-built drafted in /design/floor-plans","required":true},
  {"id":"g2","title":"Create Supabase org and site records","description":"Seed org, site, and initial device records on gatecard.co Supabase project","required":true},
  {"id":"g3","title":"Configure Brivo account","description":"Set up doors, credentials, access schedules, and holiday groups","required":true},
  {"id":"g4","title":"Configure UniFi network","description":"VLANs, SSIDs, PoE switches confirmed and all devices adopted","required":true},
  {"id":"g5","title":"Deploy gatecard.co site slug","description":"Verify /[site-slug] resolves and loads live data in gatecard.co","required":true},
  {"id":"g6","title":"Resident import","description":"Upload resident CSV — Brivo credentials auto-created via sync pipeline","required":true},
  {"id":"g7","title":"PM walkthrough","description":"Live demo with property manager: kiosk, visitor management, resident app","required":true},
  {"id":"g8","title":"Go-live sign-off","description":"PM confirms acceptance, billing start date set in portal /billing","required":true}
]'::jsonb)

on conflict (id) do nothing;
