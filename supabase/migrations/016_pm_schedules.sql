-- PM Schedules: recurring preventive maintenance per site
create table if not exists pm_schedules (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid references organizations(id) on delete cascade,
  site_id             uuid references sites(id) on delete cascade,
  title               text not null,
  description         text,
  interval_days       int not null default 90,
  last_generated_at   timestamptz,
  next_due_at         timestamptz not null,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists pm_schedules_site_id_idx on pm_schedules(site_id);
create index if not exists pm_schedules_next_due_idx on pm_schedules(next_due_at) where is_active = true;
