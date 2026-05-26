-- ============================================================
-- 090_hardware_catalog_seed.sql
-- Seed the 14 hardware products from the Salesforce quote
-- "The Everett w/ LPR" — use ON CONFLICT DO NOTHING so safe to re-run.
-- All products are tagged field_service=true so they appear in /tech.
-- list_price = standard sell price from the Salesforce quote.
-- ============================================================

-- Ensure field_service column exists (safe if already present)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS field_service boolean NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS list_price   numeric(10,2) NOT NULL DEFAULT 0;

-- ── Infrastructure ─────────────────────────────────────────────────────────────
INSERT INTO public.products
  (sku, name, brand, category, subcategory, description, sell_price, list_price, msrp, field_service, active, tags)
VALUES
  (
    'GG-RACK-12U',
    '12U Wall Mount Rack',
    'GateGuard',
    'Infrastructure',
    'Enclosures & Racks',
    'Wall-mount 12U network rack for consolidating switches, routers, NVRs, and patch panels in a single enclosure. Includes mounting hardware.',
    725.00, 725.00, 850.00,
    true, true,
    ARRAY['rack','infrastructure','networking','enclosure']
  ),
  (
    'GG-CMVR-16CH',
    '16 Channel Cloud Managed Video Recorder',
    'GateGuard',
    'Video Surveillance',
    'NVR / DVR',
    '16-channel PoE NVR with cloud management, remote viewing, and motion-event recording. Compatible with Eagle Eye Networks and GateGuard SOC integration.',
    1700.00, 1700.00, 2000.00,
    true, true,
    ARRAY['nvr','cmvr','cameras','video','cloud']
  ),
  (
    'GG-SW-24POE',
    '24 Port PoE Network Switch',
    'GateGuard',
    'Infrastructure',
    'Network Switches',
    '24-port managed PoE+ switch. Powers IP cameras, intercoms, and access readers directly over Ethernet. Managed via UniFi controller.',
    1600.00, 1600.00, 1850.00,
    true, true,
    ARRAY['switch','poe','networking','unifi','infrastructure']
  ),
  (
    'GG-UPS-750',
    'Battery Back Up / UPS',
    'GateGuard',
    'Infrastructure',
    'Power',
    '750VA rackmount UPS battery backup. Provides 15–30 minutes of runtime during power outages to keep gate operators, access controllers, and network gear online.',
    750.00, 750.00, 900.00,
    true, true,
    ARRAY['ups','battery','backup','power','infrastructure']
  ),
  (
    'GG-ENC-18',
    'Exterior Enclosure 18.1"',
    'GateGuard',
    'Infrastructure',
    'Enclosures & Racks',
    'NEMA-4X rated weatherproof exterior enclosure (18.1" x 16" x 8"). Padlockable, UV-resistant. For gate operators, access controllers, and equipment mounted at entry points.',
    225.00, 225.00, 275.00,
    true, true,
    ARRAY['enclosure','weatherproof','nema','exterior','infrastructure']
  ),
  (
    'GG-RTR-RACK',
    'GateGuard Router — Rack Mount',
    'GateGuard',
    'Infrastructure',
    'Routers & Gateways',
    'GateGuard-branded rackmount router/gateway. Provides secure WAN connection, VLAN segmentation, VPN tunnel to GateGuard SOC, and remote management capability.',
    800.00, 800.00, 950.00,
    true, true,
    ARRAY['router','gateway','networking','rack','gateguard']
  ),
  (
    'GG-BRIDGE-SM',
    'GateGuard Small Network Bridge',
    'GateGuard',
    'Infrastructure',
    'Wireless Bridges',
    'Point-to-point wireless bridge for locations where running cable is impractical. Connects remote gate operators or camera clusters back to the main network rack. Up to 500ft range.',
    195.00, 195.00, 230.00,
    true, true,
    ARRAY['bridge','wireless','networking','point-to-point']
  )
ON CONFLICT (sku) DO NOTHING;

-- ── Wireless ──────────────────────────────────────────────────────────────────
INSERT INTO public.products
  (sku, name, brand, category, subcategory, description, sell_price, list_price, msrp, field_service, active, tags)
VALUES
  (
    'GG-RAP-LARGE',
    'Large Radio — Access Point',
    'GateGuard',
    'Infrastructure',
    'Wireless Access Points',
    'High-power outdoor 802.11ac Wave 2 access point. Weatherproof (IP67), dual-band, 3x3 MIMO. Covers large parking areas and common spaces. Managed via UniFi controller.',
    1200.00, 1200.00, 1400.00,
    true, true,
    ARRAY['access-point','wifi','wireless','outdoor','unifi']
  ),
  (
    'GG-RST-LARGE',
    'Large Radio — Station',
    'GateGuard',
    'Infrastructure',
    'Wireless Bridges',
    'Point-to-multipoint wireless station. Connects distributed outdoor APs or cameras back to the main distribution switch. Long-range, weatherproof.',
    800.00, 800.00, 950.00,
    true, true,
    ARRAY['radio','station','wireless','bridge','outdoor']
  ),
  (
    'GG-SW10G',
    'SW10g Switch',
    'GateGuard',
    'Infrastructure',
    'Network Switches',
    '10-port 10G fiber/copper managed switch. Used for high-bandwidth backbone links between IDF closets and the main MDF rack. UniFi managed.',
    360.00, 360.00, 425.00,
    true, true,
    ARRAY['switch','10g','fiber','networking','backbone']
  )
ON CONFLICT (sku) DO NOTHING;

-- ── Cameras ───────────────────────────────────────────────────────────────────
INSERT INTO public.products
  (sku, name, brand, category, subcategory, description, sell_price, list_price, msrp, field_service, active, tags)
VALUES
  (
    'GG-CAM-LPR',
    'License Plate Camera — LPR',
    'GateGuard',
    'Video Surveillance',
    'LPR Cameras',
    'Dedicated license plate recognition camera. Integrates with Eagle Eye Networks LPR engine and Brivo access control for automated gate trigger on verified plates. IR illuminated, weatherproof.',
    1500.00, 1500.00, 1750.00,
    true, true,
    ARRAY['lpr','camera','license-plate','eagle-eye','brivo']
  ),
  (
    'GG-CAM-4MP',
    'Standard 4MP IP Camera',
    'GateGuard',
    'Video Surveillance',
    'IP Cameras',
    'Standard 4MP PoE IP camera. Wide dynamic range, IR night vision up to 100ft, weatherproof (IP67). Compatible with Eagle Eye Networks cloud VMS and GateGuard SOC monitoring.',
    500.00, 500.00, 600.00,
    true, true,
    ARRAY['camera','4mp','ip','poe','eagle-eye','outdoor']
  ),
  (
    'GG-CAM-WIDE',
    'Wide Angle Camera',
    'GateGuard',
    'Video Surveillance',
    'IP Cameras',
    '4MP wide-angle (180°) fisheye PoE IP camera. Ideal for full-coverage of parking lots, amenity areas, and pool decks. Eagle Eye compatible.',
    900.00, 900.00, 1050.00,
    true, true,
    ARRAY['camera','wide-angle','fisheye','ip','poe','eagle-eye']
  )
ON CONFLICT (sku) DO NOTHING;

-- ── Labor ─────────────────────────────────────────────────────────────────────
INSERT INTO public.products
  (sku, name, brand, category, subcategory, description, sell_price, list_price, msrp, field_service, active, tags)
VALUES
  (
    'GG-LABOR-HR',
    'Installation Labor',
    'GateGuard',
    'Labor',
    'Installation',
    'GateGuard certified installation labor. Includes all wire pulls, terminations, mounting, programming, and commissioning. Billed per hour.',
    200.00, 200.00, 200.00,
    false, true,
    ARRAY['labor','installation','technician']
  )
ON CONFLICT (sku) DO NOTHING;
