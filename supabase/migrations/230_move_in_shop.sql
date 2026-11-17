-- 230: Move-in step 4 add-ons (gate key fob first) + lease-only household.
-- site_products: what a property sells to residents (move-in step 4 now, the app's Shop later).
-- Each property sets its own price and GateGuard/property revenue share.

create table if not exists site_products (
  id                uuid primary key default gen_random_uuid(),
  site_id           uuid not null references sites(id) on delete cascade,
  sku               text not null,                               -- 'gate_fob', 'gate_remote', …
  name              text not null,                               -- "Gate key fob"
  description       text,                                        -- "Opens the vehicle and pedestrian gates only"
  price_cents       integer not null check (price_cents >= 0),
  site_share_cents  integer not null default 0 check (site_share_cents >= 0),  -- property's revenue share per item
  max_per_unit      integer not null default 2 check (max_per_unit > 0),
  fulfillment       text not null default 'office_pickup' check (fulfillment in ('office_pickup', 'ship')),
  credential_scope  text not null default 'gate_only',          -- what the credential opens when programmed
  offer_at_move_in  boolean not null default true,
  enabled           boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (site_id, sku)
);
create index if not exists idx_site_products_site on site_products(site_id);

-- Orders created when move-in completes (paid). Staff program + hand over the fob.
create table if not exists resident_orders (
  id                uuid primary key default gen_random_uuid(),
  site_id           uuid not null references sites(id) on delete cascade,
  invite_id         uuid references move_in_invites(id) on delete set null,
  product_id        uuid references site_products(id) on delete set null,
  sku               text not null,
  name              text not null,
  qty               integer not null check (qty > 0),
  unit_cents        integer not null,
  site_share_cents  integer not null default 0,                  -- per item, snapshotted
  email             text not null,                               -- buyer (resident)
  unit_number       text,
  status            text not null default 'paid' check (status in ('paid', 'programmed', 'picked_up', 'cancelled', 'refunded')),
  credential_ids    text[] not null default '{}',                -- fob numbers once programmed
  stripe_session_id text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_resident_orders_site on resident_orders(site_id, status);

-- Cart on the invite (step 4) + the lease's own household list (what the resident may switch on)
alter table move_in_invites add column if not exists cart jsonb not null default '[]'::jsonb;  -- [{ product_id, qty }]
alter table move_in_invites add column if not exists lease_household jsonb;                    -- people on the lease from admin / PMS
update move_in_invites set lease_household = household where lease_household is null;

alter table site_products   enable row level security;
alter table resident_orders enable row level security;
drop policy if exists site_products_service on site_products;
create policy site_products_service on site_products for all to service_role using (true) with check (true);
drop policy if exists resident_orders_service on resident_orders;
create policy resident_orders_service on resident_orders for all to service_role using (true) with check (true);
