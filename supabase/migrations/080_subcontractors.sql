-- Migration 080: Subcontractors
-- Creates subcontractors table + work_order_subcontractors join table
-- Access code pattern: 8-char uppercase UUID prefix for no-auth portal access

create table if not exists subcontractors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  company text,
  email text,
  phone text,
  trade text,
  license_number text,
  license_expiry date,
  insurance_expiry date,
  status text default 'active' check (status in ('active','inactive','suspended')),
  access_code text unique default upper(left(replace(gen_random_uuid()::text,'-',''), 8)),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists work_order_subcontractors (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid references work_orders(id) on delete cascade,
  subcontractor_id uuid references subcontractors(id) on delete cascade,
  assigned_at timestamptz default now(),
  notes text,
  unique(work_order_id, subcontractor_id)
);

alter table subcontractors enable row level security;
drop policy if exists "service_role_all" on subcontractors;
create policy "service_role_all" on subcontractors
  using (true)
  with check (true);

alter table work_order_subcontractors enable row level security;
drop policy if exists "service_role_all" on work_order_subcontractors;
create policy "service_role_all" on work_order_subcontractors
  using (true)
  with check (true);

-- Index for access code lookup (used by public portal route)
create index if not exists subcontractors_access_code_idx on subcontractors(access_code);
create index if not exists subcontractors_org_id_idx on subcontractors(org_id);
create index if not exists work_order_subcontractors_sub_idx on work_order_subcontractors(subcontractor_id);
create index if not exists work_order_subcontractors_wo_idx on work_order_subcontractors(work_order_id);
