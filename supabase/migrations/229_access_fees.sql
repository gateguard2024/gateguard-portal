-- 229: Parking & access (P&A) fee rules per property + redemption codes + move-in payment.
-- Every property is different (package / contract):
--   charge_per  'lease'  → one fee covers everyone on the lease
--               'person' → fee × each person who gets access (resident + household)
--   paid_by     'resident'           → resident pays GateGuard online at move-in
--               'property'           → property pays GateGuard; resident pays nothing (amenity / included in rent)
--               'property_collects'  → property charges the resident (rent ledger) and remits to GateGuard;
--                                      resident pays nothing online; GateGuard bills the property
--               'partial'            → property covers property_covers_cents per lease/person, resident pays the rest online

create table if not exists site_access_fees (
  site_id                uuid primary key references sites(id) on delete cascade,
  enabled                boolean not null default true,       -- false = no fee at this property
  amount_cents           integer not null default 15000 check (amount_cents >= 0),
  charge_per             text not null default 'lease' check (charge_per in ('lease', 'person')),
  paid_by                text not null default 'resident' check (paid_by in ('resident', 'property', 'property_collects', 'partial')),
  property_covers_cents  integer not null default 0 check (property_covers_cents >= 0),
  term_months            integer not null default 12 check (term_months > 0),
  site_share_cents       integer not null default 2500 check (site_share_cents >= 0),  -- property revenue share per fee (Stripe Connect, later)
  notes                  text,
  updated_by             text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table if not exists access_fee_codes (
  id               uuid primary key default gen_random_uuid(),
  site_id          uuid not null references sites(id) on delete cascade,
  code             text not null check (code = upper(code)),
  covers           text not null default 'full' check (covers in ('full', 'amount')),
  amount_off_cents integer check (amount_off_cents is null or amount_off_cents >= 0),
  max_uses         integer not null default 1 check (max_uses > 0),
  used_count       integer not null default 0,
  status           text not null default 'active' check (status in ('active', 'cancelled')),
  expires_at       timestamptz,
  note             text,
  created_by       text,
  created_at       timestamptz not null default now(),
  unique (site_id, code)
);
create index if not exists idx_access_fee_codes_site on access_fee_codes(site_id);

-- Snapshot of the rules on each invite (so later changes don't move a resident's price) + payment
alter table move_in_invites add column if not exists fee_charge_per        text not null default 'lease' check (fee_charge_per in ('lease', 'person'));
alter table move_in_invites add column if not exists property_covers_cents integer not null default 0;
alter table move_in_invites add column if not exists term_months           integer not null default 12;
alter table move_in_invites add column if not exists code_id               uuid references access_fee_codes(id) on delete set null;
alter table move_in_invites add column if not exists amount_due_cents      integer;   -- resident pays online
alter table move_in_invites add column if not exists property_owes_cents   integer;   -- GateGuard bills the property (property / property_collects / partial)
-- widen 227's check to include the new case
alter table move_in_invites drop constraint if exists move_in_invites_fee_paid_by_check;
alter table move_in_invites add constraint move_in_invites_fee_paid_by_check
  check (fee_paid_by in ('resident', 'property', 'property_collects', 'partial'));
alter table move_in_invites add column if not exists payment_status        text not null default 'unpaid'
  check (payment_status in ('unpaid', 'pending', 'paid', 'not_required'));
alter table move_in_invites add column if not exists stripe_session_id     text;
alter table move_in_invites add column if not exists paid_at               timestamptz;
create index if not exists idx_move_in_invites_stripe on move_in_invites(stripe_session_id) where stripe_session_id is not null;

alter table site_access_fees  enable row level security;
alter table access_fee_codes  enable row level security;
drop policy if exists site_access_fees_service on site_access_fees;
create policy site_access_fees_service on site_access_fees for all to service_role using (true) with check (true);
drop policy if exists access_fee_codes_service on access_fee_codes;
create policy access_fee_codes_service on access_fee_codes for all to service_role using (true) with check (true);

-- Atomic "use a code once": returns true if a use was taken.
create or replace function use_access_fee_code(p_code_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  update access_fee_codes
     set used_count = used_count + 1
   where id = p_code_id and status = 'active' and used_count < max_uses
     and (expires_at is null or expires_at > now())
  returning true into ok;
  return coalesce(ok, false);
end $$;
revoke all on function use_access_fee_code(uuid) from public, anon, authenticated;
