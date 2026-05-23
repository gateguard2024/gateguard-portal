-- Floor plans
create table if not exists floor_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,
  site_id uuid,
  name text not null,
  level text,
  file_url text,
  file_type text default 'blank',
  status text default 'draft',
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists floor_plan_devices (
  id uuid primary key default gen_random_uuid(),
  floor_plan_id uuid references floor_plans(id) on delete cascade,
  product_id uuid,
  device_type text,
  label text not null,
  icon_key text,
  x_pct numeric not null,
  y_pct numeric not null,
  condition text default 'good',
  action text default 'keep',
  notes text,
  photo_urls text[],
  created_at timestamptz default now()
);

create table if not exists floor_plan_connections (
  id uuid primary key default gen_random_uuid(),
  floor_plan_id uuid references floor_plans(id) on delete cascade,
  from_device_id uuid references floor_plan_devices(id) on delete cascade,
  to_device_id uuid references floor_plan_devices(id) on delete cascade,
  cable_type text default 'cat6',
  estimated_length_ft integer,
  from_terminal text,
  to_terminal text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists floor_plan_annotations (
  id uuid primary key default gen_random_uuid(),
  floor_plan_id uuid references floor_plans(id) on delete cascade,
  annotation_type text,
  x_pct numeric, y_pct numeric,
  x2_pct numeric, y2_pct numeric,
  text_content text,
  color text default '#EF4444',
  created_at timestamptz default now()
);

create table if not exists esign_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,
  name text not null,
  document_type text,
  status text default 'pending',
  signer_name text,
  signer_email text,
  sent_at timestamptz,
  signed_at timestamptz,
  signature_data text,
  related_quote_id uuid,
  token text unique default encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz,
  created_at timestamptz default now()
);

alter table floor_plans enable row level security;
alter table floor_plan_devices enable row level security;
alter table floor_plan_connections enable row level security;
alter table floor_plan_annotations enable row level security;
alter table esign_documents enable row level security;

create policy "service_role_all" on floor_plans for all using (true);
create policy "service_role_all" on floor_plan_devices for all using (true);
create policy "service_role_all" on floor_plan_connections for all using (true);
create policy "service_role_all" on floor_plan_annotations for all using (true);
create policy "service_role_all" on esign_documents for all using (true);
