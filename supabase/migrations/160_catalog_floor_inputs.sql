-- Migration 160: floor_inputs on service_catalog — the cost-component build-up
-- that produces a line's floor. No new table (JSONB on the existing catalog).
--
-- floor_inputs shape (all keys optional, whole-dollar amounts):
--   { hardware_cost, labor_cost, platform_cost,   -- roll up to gg_cost
--     gg_net,                                      -- GateGuard minimum margin above cost
--     dist, sales, dealer }                        -- channel cuts
--
-- Server derives, whenever floor_inputs is present:
--   gg_cost     = hardware_cost + labor_cost + platform_cost
--   floor_price = gg_cost + gg_net + dist + sales + dealer
-- When floor_inputs is NULL the line keeps its manually typed floor_price / gg_cost.
--
-- ALTER only — no GRANT needed (existing table grants carry over). Run beta → prod.

ALTER TABLE public.service_catalog
  ADD COLUMN IF NOT EXISTS floor_inputs jsonb;

COMMENT ON COLUMN public.service_catalog.floor_inputs IS
  'Cost-component build-up for the floor: {hardware_cost,labor_cost,platform_cost,gg_net,dist,sales,dealer}. Server derives gg_cost + floor_price from it. Null = floor typed manually.';
