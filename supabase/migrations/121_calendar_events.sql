-- ============================================================
-- Nexus Calendar Events
-- Supports My Day > Today's Schedule > Add Event
-- ============================================================

create table if not exists calendar_events (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete set null,
  user_id text,
  created_by text,
  title text not null,
  description text,
  location text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  is_all_day boolean not null default false,
  status text not null default 'confirmed',
  source text not null default 'nexus',
  related_type text,
  related_id text,
  sync_status text not null default 'not_synced',
  external_calendar_id text,
  external_event_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint calendar_events_time_check check (end_time > start_time)
);

create index if not exists idx_calendar_events_org_start
on calendar_events(org_id, start_time);

create index if not exists idx_calendar_events_user_start
on calendar_events(user_id, start_time);

create index if not exists idx_calendar_events_status
on calendar_events(status);

alter table calendar_events enable row level security;

-- Service-role API routes bypass RLS, but these policies keep direct client access safe.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'calendar_events'
      and policyname = 'calendar_events_select'
  ) then
    create policy "calendar_events_select"
    on calendar_events for select
    using (
      org_id is null
      or org_id = auth_org_id()
      or org_id in (select id from organizations where parent_id = auth_org_id())
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'calendar_events'
      and policyname = 'calendar_events_insert'
  ) then
    create policy "calendar_events_insert"
    on calendar_events for insert
    with check (
      org_id is null
      or org_id = auth_org_id()
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'calendar_events'
      and policyname = 'calendar_events_update'
  ) then
    create policy "calendar_events_update"
    on calendar_events for update
    using (
      org_id is null
      or org_id = auth_org_id()
    )
    with check (
      org_id is null
      or org_id = auth_org_id()
    );
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_proc where proname = 'update_updated_at') then
    drop trigger if exists trg_calendar_events_updated_at on calendar_events;
    create trigger trg_calendar_events_updated_at
    before update on calendar_events
    for each row execute function update_updated_at();
  end if;
end $$;
