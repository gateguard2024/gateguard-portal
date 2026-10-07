-- ============================================================
-- Provision the Elevate Marbella Place ops portal (live-data demo)
-- Run on BETA first, verify, then prod.
--
-- Prereqs (must already be applied): migrations 173–177 (client_portals +
-- access_pin) and 191 (portal_managers). And the Marbella site must be
-- connected to Brivo + Eagle Eye in Systems → Setup & keys for live cameras
-- and gates to appear. If it isn't connected yet, the portal still loads —
-- it just shows "not connected" states until the keys are in.
--
-- PINs (CHANGE THESE before running):
--   VIEW passcode (shared, view-only)   = 650100
--   Russel's personal control PIN        = 4921
-- ============================================================

create extension if not exists pgcrypto;

-- STEP 0 — confirm which site this will attach to. Run this SELECT alone first.
--          If it returns the wrong row (or several), set the exact site id in
--          STEP 1 instead of the ILIKE lookup.
select id, name, city, state, org_id
from public.sites
where name ilike '%marbella%';

-- STEP 1 — create (or re-point) the portal.
with site as (
  select id, org_id, name
  from public.sites
  where name ilike '%marbella%'     -- or: where id = '<paste-site-id>'
  limit 1
)
insert into public.client_portals
  (org_id, site_id, slug, login_type, modules, branding, status, access_pin, created_by)
select
  s.org_id,
  s.id,
  'elevate-marbella-place',
  'property',
  array['gate','cameras','passes','activity','billing','service']::text[],
  jsonb_build_object('display_name','Elevate Marbella Place','accent','#00A3E0'),
  'live',
  encode(digest('gg-portal:' || '650100', 'sha256'), 'hex'),   -- VIEW passcode
  'provision-script'
from site s
on conflict (slug) do update set
  site_id    = excluded.site_id,
  org_id     = excluded.org_id,
  modules    = excluded.modules,
  branding   = excluded.branding,
  status     = excluded.status,
  access_pin = excluded.access_pin,
  updated_at = now();

-- STEP 2 — add Russel as a portal manager (personal PIN = can control gates/lockdown).
with p as (
  select id, org_id, site_id from public.client_portals where slug = 'elevate-marbella-place'
)
insert into public.portal_managers
  (client_portal_id, org_id, site_id, name, email, pin_hash, active, created_by)
select
  p.id, p.org_id, p.site_id,
  'Russel Feldman', 'rfeldman@gateguard.co',
  encode(digest('gg-portal-mgr:' || '4921', 'sha256'), 'hex'),  -- personal control PIN
  true, 'provision-script'
from p
where not exists (
  select 1 from public.portal_managers m
  where m.client_portal_id = p.id and lower(m.email) = 'rfeldman@gateguard.co'
);

-- STEP 3 — verify.
select cp.slug, cp.status, cp.branding->>'display_name' as name,
       s.name as site, cp.modules,
       (select count(*) from public.portal_managers m where m.client_portal_id = cp.id) as managers
from public.client_portals cp
left join public.sites s on s.id = cp.site_id
where cp.slug = 'elevate-marbella-place';
