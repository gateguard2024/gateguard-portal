-- ─────────────────────────────────────────────────────────────────────────────
-- 005_doorking_seed.sql
-- Seed DoorKing 6050 gate operator + 1600 barrier arm
-- First two devices in the GateGuard troubleshooting library
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.products (
  sku, name, brand, category, subcategory, description, specs,
  msrp, dealer_cost, sell_price,
  tags, install_time_hrs, active
) VALUES
(
  'DK-6050',
  '6050 Slide Gate Operator',
  'DoorKing',
  'Gate Operator',
  'Slide Gate',
  'Heavy-duty commercial slide gate operator. 1/2 HP DC motor with soft-start/soft-stop. Handles gates up to 1,400 lbs and 40 ft. Built-in receiver for 318 MHz DoorKing transmitters. Includes obstruction sensing, auto-close timer, and battery backup capability. Most common operator in GateGuard multifamily installs.',
  '115V AC / 1/2 HP DC motor / Max gate weight: 1400 lbs / Max gate width: 40 ft / Speed: 1 ft/sec / Frequency: 318 MHz / Operating temp: -20°F to 140°F / UL 325 listed',
  1895.00, 1250.00, 1595.00,
  ARRAY['slide','gate','commercial','residential','dc-motor','battery-backup','ul-325'],
  6.0,
  true
),
(
  'DK-1600',
  '1600 Traffic Control Barrier',
  'DoorKing',
  'Gate Operator',
  'Barrier Arm',
  'Parking and traffic control barrier arm operator. Loop detector input standard. Arm lengths available 8–20 ft. 115V AC with built-in transformer. Spring counterbalance with adjustable spring tension. Anti-tailgate loop option. Common in parking garages and secondary entry lanes.',
  '115V AC / 60 Hz / 15A circuit recommended / Arm lengths: 8–20 ft / Cycle time: 3 sec (standard) / Counterbalance: spring / Loop detector: built-in / Operating temp: 0°F to 130°F',
  1495.00, 975.00, 1295.00,
  ARRAY['barrier','arm','parking','traffic','loop-detector','commercial'],
  4.0,
  true
)
ON CONFLICT (sku) DO UPDATE SET
  description      = EXCLUDED.description,
  tags             = EXCLUDED.tags,
  install_time_hrs = EXCLUDED.install_time_hrs,
  updated_at       = now();
