-- Migration 101: Expand ISP, video, and proptech provider catalogs
-- Adds managed Wi-Fi integrators, streaming video providers, camera/security brands,
-- and gate/access brands from the expanded GateGuard provider reference list.

-- ─── mdu_providers: Add managed Wi-Fi integrators not yet seeded ─────────────
-- Required columns: name, slug, provider_type, tier (NOT NULL), active

INSERT INTO public.mdu_providers (name, slug, provider_type, tier, active, notes)
VALUES
  ('Hotwire Communications', 'hotwire', 'isp', 'specialist', true, 'Fision brand. Fiber-heavy MDU provider, dominant in Florida/Southeast HOAs and luxury MDU.'),
  ('Smartaira', 'smartaira', 'both', 'specialist', true, 'Formerly Consolidated Smart Systems. National integrator — white-labeled managed Wi-Fi + bulk DirecTV.'),
  ('White Sky', 'white-sky', 'isp', 'specialist', true, 'Managed Wi-Fi specialist. Property-wide network: pool, parking garage, units. No dead zones.'),
  ('Windstream / Kinetic', 'windstream', 'isp', 'regional', true, 'Kinetic Communities brand. Fiber/broadband for MDUs in rural and mid-market areas.'),
  ('Nextlink Internet', 'nextlink', 'isp', 'regional', true, 'Fiber and fixed wireless for MDUs, especially central US.'),
  ('GoNetspeed', 'gonetspeed', 'isp', 'regional', true, 'Bulk fiber for MDU communities — 300 Mbps to 2 Gbps.'),
  ('Lux Speed', 'lux-speed', 'isp', 'regional', true, 'Community internet with overlapping Wi-Fi mesh to eliminate single points of failure.'),
  ('Resound Networks', 'resound-networks', 'isp', 'regional', true, 'Rural and secondary market MDU Wi-Fi, wireless deployment.'),
  ('Aeronet', 'aeronet', 'isp', 'regional', true, 'Regional fixed wireless and fiber provider for MDU.'),
  ('OneStop Communications', 'onestop-communications', 'isp', 'regional', true, 'Atlanta-based. Helps HOAs and condo associations set up bulk telecom agreements.'),
  ('Giggle Fiber', 'giggle-fiber', 'isp', 'regional', true, 'Localized regional ISP providing hyper-local MDU Wi-Fi.'),
  -- Video streaming bundles (often paired with managed Wi-Fi)
  ('Sling TV (MDU)', 'sling-tv-mdu', 'video', 'national', true, 'Streaming-only bulk video — often paired with managed Wi-Fi integrators as DirecTV alternative.'),
  ('Philo (MDU)', 'philo-mdu', 'video', 'national', true, 'Streaming-only bulk video package. No contract, low cost. Increasingly used in Class B/C.'),
  ('Fubo TV (MDU)', 'fubo-tv-mdu', 'video', 'national', true, 'Sports-focused streaming bundle. Used in some MDU bulk video agreements.')
ON CONFLICT (slug) DO NOTHING;

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
-- Note: mdu_providers already exists, no GRANT needed for ALTER-style inserts

-- ─── aria_tech_providers: Add missing camera/security brands ─────────────────

INSERT INTO public.aria_tech_providers (name, slug, category, aliases, displacement_target, notes)
VALUES
  -- Cameras / Video Surveillance
  ('Eagle Eye Networks', 'eagle-eye-networks', 'camera', ARRAY['Eagle Eye Cloud VMS'], true,
   'Cloud VMS platform — connects legacy cameras to modern cloud dashboard. Popular upgrade path.'),
  ('Deep Sentinel', 'deep-sentinel', 'camera', ARRAY['DeepSentinel'], true,
   'AI cameras + live professional guards with 2-way speaker deterrence. MDU residential security.'),
  ('Flock Safety', 'flock-safety', 'camera', ARRAY['Flock ALPR'], true,
   'Automated License Plate Reading (ALPR) cameras. Heavily adopted by HOAs + MDU for vehicle tracking.'),
  ('Stealth Monitoring', 'stealth-monitoring', 'camera', ARRAY['Stealth Monitor'], false,
   'Proactive live video monitoring. Remote staff watch cameras in real-time to deter crime.'),
  ('Rhombus Systems', 'rhombus-systems', 'camera', ARRAY['Rhombus'], true,
   'Cloud-managed physical security + IoT camera networks. Growing MDU presence.'),
  ('Ring for Business', 'ring-for-business', 'camera', ARRAY['Ring Business','Amazon Ring'], true,
   'Entry-level perimeter monitoring. Used by smaller landlords and HOAs.'),
  -- Gate / Access Control additions
  ('CellGate', 'cellgate', 'gate', ARRAY['Cell Gate'], true,
   'Cellular-based gate access control + video intercom. Popular in sprawling HOAs where cable runs to front gate are prohibitive.'),
  ('Rently', 'rently', 'gate', ARRAY['Rently Access'], true,
   'Access control hardware + self-guided tour technology. Smart lock + entry combined.'),
  -- ISP/Managed Wi-Fi entries in aria_tech_providers (for proptech catalog tracking)
  ('GigStreem', 'gigstreem-isp', 'isp', ARRAY['Gigstreem','GIGstreem'], true,
   'National managed Wi-Fi. MDU-only. Portfolio-level deals. AMLI, UDR. SARA target.'),
  ('Hotwire Communications', 'hotwire-isp', 'isp', ARRAY['Hotwire','Fision'], true,
   'Fiber-heavy MDU ISP. Southeast / Florida dominant. HOAs and luxury MDU.'),
  ('Pavlov Media', 'pavlov-media-isp', 'isp', ARRAY['Pavlov'], true,
   'National independent ISP. Student housing + conventional MF. SARA target.'),
  ('Smartaira', 'smartaira-isp', 'isp', ARRAY['Consolidated Smart Systems'], true,
   'White-label managed Wi-Fi + bulk DirecTV. National integrator.'),
  ('DojoNetworks', 'dojonetworks-isp', 'isp', ARRAY['Dojo Networks','Dojo'], true,
   'Centralized managed Wi-Fi. Reduces property opex. Growing MDU.'),
  ('White Sky', 'white-sky-isp', 'isp', ARRAY['WhiteSky'], true,
   'Property-wide managed Wi-Fi. No dead zones from pool to parking. National.'),
  ('Boingo Wireless', 'boingo-wireless-isp', 'isp', ARRAY['Boingo'], true,
   'Managed Wi-Fi deployments in military housing, student housing, large MDU complexes.'),
  ('Single Digits', 'single-digits-isp', 'isp', ARRAY['SingleDigits'], true,
   'Managed Wi-Fi software + service for multifamily and hospitality.'),
  ('Starry Internet', 'starry-internet-isp', 'isp', ARRAY['Starry'], true,
   'Fixed-wireless from local towers to MDU rooftops. Now part of Verizon.'),
  ('Midco', 'midco-isp', 'isp', ARRAY['MIDCO'], true,
   'MDU cable and fiber. Dominant in Midwest and Dakotas.'),
  ('Nextlink Internet', 'nextlink-isp', 'isp', ARRAY['Nextlink'], true,
   'Fiber and fixed wireless to MDUs. Central US.'),
  ('GoNetspeed', 'gonetspeed-isp', 'isp', ARRAY['GoNet Speed'], true,
   'Bulk fiber 300 Mbps–2 Gbps for MDU communities.')
ON CONFLICT (slug) DO NOTHING;

-- Grant Data API access
GRANT ALL ON TABLE public.aria_tech_providers TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.mdu_providers TO postgres, anon, authenticated, service_role;
