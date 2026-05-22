-- Migration 073: Add Gigstreem to mdu_providers + update existing ISP entries
-- Discovery: Gigstreem has portfolio-level AMLI deal (gigstreem.com/amli/)
-- Correct spelling is "Gigstreem" — "Gigastream" is a common misspelling. Both appear in web content.
-- Also adds Spot On Networks, Wyyerd, Pavlov Media, Bsquared as MDU-specific ISPs.

-- Gigstreem (key finding from AMLI Marina Del Rey investigation)
INSERT INTO mdu_providers (name, slug, provider_type, active, property_page_pattern, operator_page_pattern, notes)
VALUES (
  'Gigstreem',
  'gigstreem',
  'isp',
  true,
  'https://gigstreem.com/{property}',
  'https://gigstreem.com/{operator}',
  'MDU-only ISP. Portfolio-level mgmt company pages at gigstreem.com/[mgmt-co-slug] (e.g. gigstreem.com/amli/). Common misspelling: Gigastream — treat as same ISP. Confirmed AMLI portfolio deal. Also serves UDR properties (Jefferson at Marina del Rey). Fiber-based, instant-on, no installer.'
)
ON CONFLICT (slug) DO UPDATE SET
  property_page_pattern = EXCLUDED.property_page_pattern,
  operator_page_pattern = EXCLUDED.operator_page_pattern,
  notes = EXCLUDED.notes,
  active = true;

-- Spot On Networks
INSERT INTO mdu_providers (name, slug, provider_type, active, property_page_pattern, operator_page_pattern, notes)
VALUES (
  'Spot On Networks',
  'spot-on-networks',
  'isp',
  true,
  'https://spotonnetworks.com/{property}',
  NULL,
  'MDU managed WiFi provider. Primarily serves student housing and multifamily. RUCKUS-based infrastructure.'
)
ON CONFLICT (slug) DO NOTHING;

-- Wyyerd (formerly Cox Communities)
INSERT INTO mdu_providers (name, slug, provider_type, active, property_page_pattern, operator_page_pattern, notes)
VALUES (
  'Wyyerd',
  'wyyerd',
  'isp',
  true,
  'https://wyyerd.com/{property}',
  NULL,
  'MDU fiber ISP. Formerly operated as Cox Communities in some markets. Bulk fiber deals for multifamily.'
)
ON CONFLICT (slug) DO NOTHING;

-- Pavlov Media
INSERT INTO mdu_providers (name, slug, provider_type, active, property_page_pattern, operator_page_pattern, notes)
VALUES (
  'Pavlov Media',
  'pavlov-media',
  'isp',
  true,
  'https://pavlovmedia.com/{property}',
  NULL,
  'MDU internet provider. Lists individual community portal pages. Strong Midwest presence.'
)
ON CONFLICT (slug) DO NOTHING;

-- Bsquared (B2 Networks)
INSERT INTO mdu_providers (name, slug, provider_type, active, property_page_pattern, operator_page_pattern, notes)
VALUES (
  'Bsquared',
  'bsquared',
  'isp',
  true,
  NULL,
  NULL,
  'MDU bulk internet provider. PCO. Sometimes appears in OM ancillary income sections.'
)
ON CONFLICT (slug) DO NOTHING;
