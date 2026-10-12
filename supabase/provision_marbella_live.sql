-- Provision a LIVE portal slug for 861 Marbella Place so the new dashboard +
-- events pages can be viewed on beta. Run on the BETA Supabase project
-- (same one where Eagle Eye + Brivo are connected for this site).
--
-- Opens at:  /portal/marbella            (resident-style root)
--            /portal/marbella/dashboard  (the new command center)
--            /portal/marbella/activity   (events page — once deployed)
--
-- PINs (change before running): VIEW passcode = 650100 · Russel control PIN = 4921

create extension if not exists pgcrypto;

-- STEP 1 — create (or re-point) the portal on the Marbella site.
insert into public.client_portals
  (org_id, site_id, slug, login_type, modules, branding, status, access_pin, created_by)
select s.org_id, s.id, 'marbella', 'property',
       array['gate','cameras','passes','activity','billing','service']::text[],
       jsonb_build_object('display_name','861 Marbella Place','accent','#4A8CFF'),
       'live',
       encode(digest('gg-portal:' || '650100','sha256'),'hex'),
       'provision-script'
from public.sites s
where s.id = '020c185f-628c-447f-944c-9a3ec0ddcd72'   -- the connected Marbella site
on conflict (slug) do update set
  site_id = excluded.site_id, org_id = excluded.org_id, modules = excluded.modules,
  branding = excluded.branding, status = excluded.status, access_pin = excluded.access_pin,
  updated_at = now();

-- STEP 2 — add Russel as a manager (personal PIN = can control gates/lockdown).
with p as (select id, org_id, site_id from public.client_portals where slug = 'marbella')
insert into public.portal_managers
  (client_portal_id, org_id, site_id, name, email, pin_hash, active, created_by)
select p.id, p.org_id, p.site_id, 'Russel Feldman', 'rfeldman@gateguard.co',
       encode(digest('gg-portal-mgr:' || '4921','sha256'),'hex'), true, 'provision-script'
from p
where not exists (select 1 from public.portal_managers m where m.client_portal_id = p.id and lower(m.email)='rfeldman@gateguard.co');

-- STEP 3 — verify.
select cp.slug, cp.status, cp.branding->>'display_name' as name, s.name as site,
       (select count(*) from public.portal_managers m where m.client_portal_id = cp.id) as managers
from public.client_portals cp left join public.sites s on s.id = cp.site_id
where cp.slug = 'marbella';
