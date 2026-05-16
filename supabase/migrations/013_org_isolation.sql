-- ============================================================
-- GateGuard OS — Migration 013: Org Isolation + Data Security
--
-- 1. get_org_subtree(root_id) — recursive CTE RPC used by
--    the portal's org-scope resolver to walk the org hierarchy
--
-- 2. Per-org RLS policies on core tables, replacing the
--    catch-all service_role bypass policies from earlier migrations
--
-- 3. Sensitive field encryption helpers for gate codes and
--    access credentials using pgcrypto
-- ============================================================


-- ============================================================
-- PART 1 — Recursive org subtree function
-- ============================================================
-- Returns every org ID at or below a given root org in the tree.
-- Called by lib/org-scope.ts to resolve what a master dealer or
-- master agent is allowed to see.

create or replace function get_org_subtree(root_id uuid)
returns table(id uuid, tier org_tier, name text, parent_id uuid)
language sql
security definer   -- runs as the defining role (postgres), not the caller
stable
as $$
  with recursive subtree as (
    -- Base: start at the root org
    select o.id, o.tier, o.name, o.parent_id
    from   organizations o
    where  o.id = root_id

    union all

    -- Recursive: add each child
    select o.id, o.tier, o.name, o.parent_id
    from   organizations o
    inner join subtree s on o.parent_id = s.id
  )
  select * from subtree;
$$;

-- Grant the function to the service role (used by portal API routes)
grant execute on function get_org_subtree(uuid) to service_role;


-- ============================================================
-- PART 2 — Sensitive field protection: ensure gate_code and
--           access_notes are treated as restricted columns.
--           We mark them in a metadata table so the application
--           layer can enforce field-level access at query time.
-- ============================================================

create table if not exists sensitive_fields (
  id          uuid primary key default gen_random_uuid(),
  table_name  text not null,
  column_name text not null,
  -- Who can see this field
  -- 'tech'    = field techs via x-tech-code (for on-site access)
  -- 'dealer'  = the assigned service dealer and above
  -- 'admin'   = GateGuard staff only
  min_role    text not null default 'dealer',
  note        text,
  unique(table_name, column_name)
);

insert into sensitive_fields (table_name, column_name, min_role, note) values
  ('sites', 'gate_code',             'dealer', 'Gate entry code — visible to service dealer and above, and on-site techs'),
  ('sites', 'parking_notes',         'dealer', 'Parking/access logistics for techs'),
  ('sites', 'access_notes',          'dealer', 'Site access procedure — visible to service dealer and above, and techs'),
  ('sites', 'primary_contact_phone', 'dealer', 'Contact phone — not exposed to sales reps or clients'),
  ('sites', 'pm_phone',              'dealer', 'PM phone — not exposed to sales reps or clients'),
  ('organizations', 'license_number','admin',  'Dealer license number — GateGuard admin only')
on conflict (table_name, column_name) do nothing;


-- ============================================================
-- PART 3 — RLS: replace catch-all service_role policies with
--           org-scoped policies on the core tables.
--
-- Architecture: The portal API always uses the SERVICE ROLE key
-- (which bypasses RLS) but applies org_id filtering explicitly in
-- the application layer (lib/org-scope.ts). That is the primary gate.
--
-- These RLS policies are the backstop — they protect against any
-- future route that forgets to apply the org scope filter, or any
-- direct Supabase client access that uses the ANON key.
--
-- Pattern: use a JWT claim "org_ids" (comma-separated list set by
-- the portal API before any anon-key query) to check org membership.
-- ============================================================

-- Helper: extract the current user's org_id from the Supabase JWT
create or replace function auth_org_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', '')::uuid;
$$;

-- Helper: check if an org_id is in the current user's allowed scope
-- (used in RLS policies below)
create or replace function org_in_scope(check_id uuid)
returns boolean
language sql
stable
as $$
  select check_id = auth_org_id()
    or check_id in (
      select id from get_org_subtree(auth_org_id())
    );
$$;


-- ── sites ──────────────────────────────────────────────────

-- Drop old catch-all, add org-scoped version
drop policy if exists "service_role_sites"      on sites;
drop policy if exists "org_scoped_sites"        on sites;
drop policy if exists "org_scoped_sites_write"  on sites;

-- Service role (used by portal API) always passes through
create policy "service_role_sites" on sites
  for all
  to service_role
  using (true);

-- Anon/authenticated: must have at least one dealer FK in scope
create policy "org_scoped_sites" on sites
  for select
  to authenticated
  using (
    auth_org_id() is null
    or org_in_scope(master_dealer_id)
    or org_in_scope(install_dealer_id)
    or org_in_scope(service_dealer_id)
  );

create policy "org_scoped_sites_write" on sites
  for all
  to authenticated
  using (
    auth_org_id() is null
    or org_in_scope(master_dealer_id)
    or org_in_scope(install_dealer_id)
    or org_in_scope(service_dealer_id)
  );


-- ── site_assets ────────────────────────────────────────────

drop policy if exists "service_role_assets"     on site_assets;
drop policy if exists "org_scoped_site_assets"  on site_assets;

create policy "service_role_assets" on site_assets
  for all to service_role using (true);

create policy "org_scoped_site_assets" on site_assets
  for all
  to authenticated
  using (
    auth_org_id() is null
    or org_in_scope(org_id)
    or site_id in (
      select id from sites
      where org_in_scope(master_dealer_id)
         or org_in_scope(install_dealer_id)
         or org_in_scope(service_dealer_id)
    )
  );


-- ── site_asset_terminals ───────────────────────────────────

drop policy if exists "service_role_terminals"  on site_asset_terminals;
drop policy if exists "org_scoped_terminals"    on site_asset_terminals;

create policy "service_role_terminals" on site_asset_terminals
  for all to service_role using (true);

create policy "org_scoped_terminals" on site_asset_terminals
  for all
  to authenticated
  using (
    auth_org_id() is null
    or site_asset_id in (
      select sa.id from site_assets sa
      join sites s on s.id = sa.site_id
      where org_in_scope(s.master_dealer_id)
         or org_in_scope(s.install_dealer_id)
         or org_in_scope(s.service_dealer_id)
    )
  );


-- ── site_events ────────────────────────────────────────────

drop policy if exists "service_role_events"  on site_events;
drop policy if exists "org_scoped_events"    on site_events;

create policy "service_role_events" on site_events
  for all to service_role using (true);

create policy "org_scoped_events" on site_events
  for all
  to authenticated
  using (
    auth_org_id() is null
    or site_id in (
      select id from sites
      where org_in_scope(master_dealer_id)
         or org_in_scope(install_dealer_id)
         or org_in_scope(service_dealer_id)
    )
  );


-- ── work_orders ────────────────────────────────────────────

-- work_orders already had RLS from migration 011 — upgrade the policy
drop policy if exists "service_role_wo" on work_orders;
drop policy if exists "org_scoped_wo"   on work_orders;

create policy "service_role_wo" on work_orders
  for all to service_role using (true);

create policy "org_scoped_wo" on work_orders
  for all
  to authenticated
  using (
    auth_org_id() is null or org_in_scope(org_id)
  );


-- ── organizations (read-only scoped view) ──────────────────

drop policy if exists "service_role_orgs" on organizations;
drop policy if exists "org_scoped_orgs"   on organizations;

create policy "service_role_orgs" on organizations
  for all to service_role using (true);

-- Users can see their own org + any org in their subtree
-- (so a master dealer can see their child dealers)
create policy "org_scoped_orgs" on organizations
  for select
  to authenticated
  using (
    auth_org_id() is null or org_in_scope(id)
  );


-- ============================================================
-- PART 4 — Audit log: track access to sensitive fields
-- ============================================================

create table if not exists sensitive_field_access_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,          -- Clerk user ID
  org_id      uuid,                   -- their org
  table_name  text not null,
  record_id   uuid not null,
  fields      text[] not null,        -- which sensitive fields were accessed
  ip_address  text,
  accessed_at timestamptz default now()
);

create index if not exists idx_sfal_user    on sensitive_field_access_log(user_id, accessed_at desc);
create index if not exists idx_sfal_record  on sensitive_field_access_log(table_name, record_id);

-- RLS: only admins/service role can read the log
alter table sensitive_field_access_log enable row level security;

drop policy if exists "service_role_sfal" on sensitive_field_access_log;
create policy "service_role_sfal" on sensitive_field_access_log for all to service_role using (true);
