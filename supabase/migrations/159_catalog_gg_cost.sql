-- Migration 159: catalog GG cost column + seed access-control setup/add lines
-- (extends 157's ONE-catalog model — no new table)
--
--  1. gg_cost on service_catalog — corporate records what each line COSTS
--     GateGuard, so the Pricing Console can show live margin (target - cost).
--     Nullable: null = cost not entered yet. ALTER only, so no GRANT is needed
--     (the table's existing grants carry over).
--
--  2. Seed the 8 access-control setup / add lines Russel listed for the
--     calculator: door setup (working / non-working), the 4 Smart No-Tour lock
--     setups, add credential reader, add callbox. Prices are left NULL on
--     purpose — corporate enters floor / target / cost directly in the Console.
--     Gate setup fees (B1.*) and Video Concierge (C6) already exist from 157.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS + ON CONFLICT DO NOTHING). Run beta → prod.

-- ─── 1. GG cost column ───────────────────────────────────────────────────────
ALTER TABLE public.service_catalog
  ADD COLUMN IF NOT EXISTS gg_cost numeric;   -- GateGuard unit cost (COGS); null = not set

COMMENT ON COLUMN public.service_catalog.gg_cost IS
  'GateGuard unit cost (COGS) for margin tracking in the Pricing Console. Null = not entered yet.';

-- ─── 2. Seed access-control setup / add line items (bucket B) ─────────────────
-- base_price mirrors target (0 when undefined) since 070 declared it NOT NULL.
INSERT INTO public.service_catalog
  (item_code, name, provider, category, billing_type, unit_label, base_price,
   floor_price, target_price, gg_cost, bucket, status, quotable, dealer_visible,
   is_gateguard_program, requires_enrollment, contract_months, notes, sort_order)
VALUES
  ('B2.DOOR_SETUP_WORKING',     'Access Control door setup fee — Working',        'GateGuard','access_control','one_time','door',    0, NULL, NULL, NULL, 'B','for_review', true, true, true, false, 60, 'Per door, set by survey. Brings a working door onto managed access.', 42),
  ('B2.DOOR_SETUP_NONWORKING',  'Access Control door setup fee — Non-working',    'GateGuard','access_control','one_time','door',    0, NULL, NULL, NULL, 'B','for_review', true, true, true, false, 60, 'Per door. Any repair required to reach launch = Non-working. When in doubt, classify Non-working.', 43),
  ('B3.LOCK_EXIST_BASIC',       'Smart No-Tour lock setup — Existing, basic',     'GateGuard','smart_locks',   'one_time','lock',    0, NULL, NULL, NULL, 'B','for_review', true, true, true, false, 60, 'Per lock. Property''s existing door, basic (no crash bar).', 44),
  ('B3.LOCK_NEW_BASIC',         'Smart No-Tour lock setup — New, basic',          'GateGuard','smart_locks',   'one_time','lock',    0, NULL, NULL, NULL, 'B','for_review', true, true, true, false, 60, 'Per lock. GateGuard supplies the lock, basic (no crash bar).', 45),
  ('B3.LOCK_EXIST_CRASH',       'Smart No-Tour lock setup — Existing, crash bar', 'GateGuard','smart_locks',   'one_time','lock',    0, NULL, NULL, NULL, 'B','for_review', true, true, true, false, 60, 'Per lock. Existing door with a crash bar / panic hardware.', 46),
  ('B3.LOCK_NEW_CRASH',         'Smart No-Tour lock setup — New, crash bar',      'GateGuard','smart_locks',   'one_time','lock',    0, NULL, NULL, NULL, 'B','for_review', true, true, true, false, 60, 'Per lock. New lock on a door with crash bar / panic hardware.', 47),
  ('B4.READER',                 'Add credential reader',                          'GateGuard','access_control','one_time','reader',  0, NULL, NULL, NULL, 'B','for_review', true, true, true, false, 60, 'Per credential reader added at an access point.', 48),
  ('B5.CALLBOX',                'Add callbox',                                    'GateGuard','access_control','one_time','callbox', 0, NULL, NULL, NULL, 'B','for_review', true, true, true, false, 60, 'Per callbox. Base callbox add (UniFi Tier-2 upgrade is C3.CALLBOX_TIER2, separate).', 49)
ON CONFLICT (item_code) WHERE item_code IS NOT NULL DO NOTHING;
