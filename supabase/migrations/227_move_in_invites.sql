-- 227: Move-in & renewal invites (Part 3, lifecycle step 2-3)
-- One row per resident setup link. The token in the URL is the credential
-- (portal.gateguard.co/move-in/{token}) — no login until setup is complete.
-- Written only by the server (service role). Residents never read this table directly.

create table if not exists move_in_invites (
  id                   uuid primary key default gen_random_uuid(),
  token                text not null unique default (replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)),  -- 48 hex chars, no pgcrypto needed
  site_id              uuid not null references sites(id) on delete cascade,
  kind                 text not null default 'move_in' check (kind in ('move_in', 'renewal')),
  source               text not null default 'portal' check (source in ('portal', 'yardi', 'brivo_pms', 'import')),

  -- From the lease (prefilled; resident confirms)
  email                text not null check (email = lower(email)),
  first_name           text,
  last_name            text,
  phone                text,
  unit_number          text,
  move_in_date         date,
  lease_end_date       date,
  household            jsonb not null default '[]'::jsonb,  -- others on the lease: [{first_name,last_name,email,phone}]

  -- Parking & access fee for this lease term
  fee_cents            integer not null default 15000 check (fee_cents >= 0),
  fee_paid_by          text not null default 'resident' check (fee_paid_by in ('resident', 'property', 'partial')),
  resident_fee_cents   integer check (resident_fee_cents is null or resident_fee_cents >= 0),

  -- Progress
  status               text not null default 'created'
                       check (status in ('created', 'sent', 'opened', 'in_progress', 'complete', 'cancelled', 'expired')),
  step                 text not null default 'details',      -- details | photo | access | services | review | done
  details_confirmed_at timestamptz,
  photo_path           text,                                 -- storage: resident-photos/{site_id}/{invite_id}.jpg
  photo_skipped        boolean not null default false,
  completed_at         timestamptz,
  access_id            uuid references resident_app_access(id) on delete set null,  -- set when access turns on

  -- Email
  sent_count           integer not null default 0,
  last_sent_at         timestamptz,
  opened_at            timestamptz,

  expires_at           timestamptz not null default (now() + interval '60 days'),
  created_by           text,                                 -- clerk user id or 'system'
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_move_in_invites_site    on move_in_invites(site_id);
create index if not exists idx_move_in_invites_email   on move_in_invites(site_id, email);
create index if not exists idx_move_in_invites_status  on move_in_invites(status) where status not in ('complete', 'cancelled', 'expired');

alter table move_in_invites enable row level security;
drop policy if exists move_in_invites_service on move_in_invites;
create policy move_in_invites_service on move_in_invites for all to service_role using (true) with check (true);

-- Private bucket for resident photos (staff-only view via signed URLs)
insert into storage.buckets (id, name, public)
values ('resident-photos', 'resident-photos', false)
on conflict (id) do nothing;
