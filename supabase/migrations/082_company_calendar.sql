-- Migration 082: GateGuard company-wide calendar events
-- Run on beta Supabase first, verify /api/calendar/company, then prod.

create table if not exists company_calendar_events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  event_type  text not null, -- 'l10', 'work_order', 'permit_renewal', 'quote_expiry', 'contract_renewal', 'manual'
  date        date not null,
  time        time,
  all_day     boolean default false,
  notes       text,
  link        text,
  org_id      uuid references organizations(id),
  created_by  text,
  created_at  timestamptz default now()
);

create index if not exists company_calendar_events_date_idx on company_calendar_events(date);

alter table company_calendar_events enable row level security;

create policy "service_role_all" on company_calendar_events
  for all to service_role using (true);

create policy "authenticated_read" on company_calendar_events
  for select to authenticated using (true);
