-- Migration 033: QuickBooks customer import
-- 35 client organizations imported from Gate Guard, LLC. QuickBooks export (May 18, 2026)
-- All imported as org_tier = 'client', parent = GateGuard Corporate

INSERT INTO organizations (
  name, tier, slug, primary_email, primary_phone,
  address, city, state, zip, notes, is_active
) VALUES
  ('Ageis', 'client', 'ageis-client', NULL, NULL, NULL, NULL, NULL, NULL, 'QB Import May 2026', true),
  ('Angel Oak - AOCA', 'client', 'angel-oak-aoca-client', 'sammy.laroche@angeloakcapital.com', '(912) 996-6711', '980 Hammond Drive, 200', 'Atlanta', 'GA', '30328', 'QB Import May 2026. Contact: Sammy Laroche', true),
  ('Angel Oak - AOCANX', 'client', 'angel-oak-aocanx-client', 'sammy.laroche@angeloakcapital.com', '(912) 996-6711', '1370 Ave of the Americas, 780', 'New York', 'NY', '10019', 'QB Import May 2026. Contact: Sammy Laroche', true),
  ('Angel Oak - AOMS', 'client', 'angel-oak-aoms-client', 'sammy.laroche@angeloakcapital.com', '(912) 996-6711', '980 Hammond Dr, 800', 'Atlanta', 'GA', '30328', 'QB Import May 2026. Contact: Sammy Laroche', true),
  ('Atrium at Collegetown', 'client', 'atrium-at-collegetown-client', 'Kanika.White@mercyhousing.org', '(865) 216-4957', '435 Joseph E Lowery Blvd SW', 'Atlanta', 'GA', '30310', 'QB Import May 2026. Contact: Kanika White', true),
  ('Brentwood Apartments', 'client', 'brentwood-apartments-client', 'thomas.sbalchiero@radcoliving.com', NULL, NULL, NULL, NULL, NULL, 'QB Import May 2026', true),
  ('Columbia Gardens', 'client', 'columbia-gardens-client', 'ghypolite@columbiares.com', NULL, NULL, NULL, NULL, NULL, 'QB Import May 2026', true),
  ('Columbia Mechanicsville', 'client', 'columbia-mechanicsville-client', 'ghypolite@columbiares.com', NULL, '500 McDaniel St SW', 'Atlanta', 'GA', '30312', 'QB Import May 2026. Contact: Gregg Hypolite', true),
  ('Columbia Residential', 'client', 'columbia-residential-client', 'carmen@columbiares.com', '(404) 349-1119', NULL, NULL, NULL, NULL, 'QB Import May 2026. Contact: Carmen', true),
  ('Columbia Senior Residences', 'client', 'columbia-senior-residences-client', 'Ghypolite@columbiares.com', NULL, '555 McDaniel St SW', 'Atlanta', 'GA', NULL, 'QB Import May 2026. Contact: Gregg Hypolite', true),
  ('David Brooks', 'client', 'david-brooks-client', 'dbrooks@radco.us', '(678) 634-3674', '4555 Washington Road', 'Atlanta', 'GA', '30349', 'QB Import May 2026', true),
  ('Elevate Eagles Landing', 'client', 'elevate-eagles-landing-client', 'twells@pegasusnext.com', NULL, '700 Rock Quarry Rd, Leasing Office', 'Stockbridge', 'GA', '30281', 'QB Import May 2026. Contact: Property Manager Tiana Wells', true),
  ('Elevate Greene', 'client', 'elevate-greene-client', 'ctelo@pegasusnext.com', '(470) 210-4080', '100 Crossing Blvd, Leasing Office', 'McDonough', 'GA', '30253', 'QB Import May 2026', true),
  ('Elevate Marbella Place', 'client', 'elevate-marbella-place-client', 'tarvares.lloyd@pegasusnext.com', '(470) 210-4080', '3470 Mt Zion Rd, Leasing Office', 'Stockbridge', 'GA', '30281', 'QB Import May 2026. Contact: Property Manager Tarvares Lloyd', true),
  ('Flint River Apartments', 'client', 'flint-river-apartments-client', 'shantel@mapleandoakmanagement.com', NULL, NULL, NULL, NULL, NULL, 'QB Import May 2026', true),
  ('Fusion Construction Group', 'client', 'fusion-construction-group-client', 'dcharles@charleswelding.com', NULL, NULL, NULL, NULL, NULL, 'QB Import May 2026', true),
  ('Home Invest', 'client', 'home-invest-client', 'chris.lavin@homeinvest.com', NULL, NULL, NULL, NULL, NULL, 'QB Import May 2026. Contact: Chris Lavin', true),
  ('Kristina Fitzpatrick', 'client', 'kristina-fitzpatrick-client', 'kafitz14@gmail.com', NULL, NULL, NULL, NULL, NULL, 'QB Import May 2026', true),
  ('Mechanicsville Crossing', 'client', 'mechanicsville-crossing-client', 'Ghypolite@columbiares.com', NULL, '555 McDaniel Street SW', 'Atlanta', 'GA', NULL, 'QB Import May 2026. Contact: Gregg Hypolite', true),
  ('Mechanicsville Station', 'client', 'mechanicsville-station-client', 'Ghypolite@columbiares.com', NULL, '520 Fulton Street', 'Atlanta', 'GA', NULL, 'QB Import May 2026. Contact: Gregg Hypolite', true),
  ('Midwood', 'client', 'midwood-client', NULL, NULL, NULL, NULL, NULL, NULL, 'QB Import May 2026', true),
  ('Midwood Gardens', 'client', 'midwood-gardens-client', NULL, NULL, NULL, NULL, NULL, NULL, 'QB Import May 2026', true),
  ('Mitul Patel', 'client', 'mitul-patel-client', NULL, NULL, NULL, NULL, NULL, NULL, 'QB Import May 2026', true),
  ('PARC 1000', 'client', 'parc-1000-client', 'dbrooks@radco.us', '(678) 634-3674', '1000 Montreal Rd', 'Clarkston', 'GA', '30021', 'QB Import May 2026. Contact: David Brooks', true),
  ('Parkside at Mechanicsville', 'client', 'parkside-at-mechanicsville-client', 'Ghypolite@columbiares.com', '(404) 702-6775', '565 McDaniel Street', 'Atlanta', 'GA', NULL, 'QB Import May 2026. Contact: Gregg Hypolite', true),
  ('PBS Aerospace', 'client', 'pbs-aerospace-client', 'daly@pbsaerospace.com', '(601) 807-8410', '1350 Northmeadow Pkwy, 130', 'Roswell', 'GA', '30076', 'QB Import May 2026. Contact: Hayes Daly', true),
  ('Pegusus Residential', 'client', 'pegusus-residential-client', 'ctelo@pegasusnext.com', '(478) 319-4451', NULL, NULL, NULL, NULL, 'QB Import May 2026. Contact: Laura Hughner', true),
  ('RAM Development Partners', 'client', 'ram-development-partners-client', 'tmeritt@rampartnersllc.com', '(770) 235-5340', NULL, NULL, NULL, NULL, 'QB Import May 2026', true),
  ('Rhythm at Camp Creek', 'client', 'rhythm-at-camp-creek-client', 'dbrooks@radco.us', NULL, NULL, NULL, NULL, NULL, 'QB Import May 2026', true),
  ('Rhythm at Riverdale', 'client', 'rhythm-at-riverdale-client', 'dbrooks@radco.us', '(224) 321-7157', '750 Chateau Ln', 'Riverdale', 'GA', '30274', 'QB Import May 2026. Contact: Tom', true),
  ('Saint Catherine of Siena Catholic Church', 'client', 'saint-catherine-of-siena-catholic-church-client', 'markr@stcatherinercc.org', NULL, '1618 Ben King Rd', 'Kennesaw', 'GA', '30144', 'QB Import May 2026', true),
  ('Stonegate Townhomes', 'client', 'stonegate-townhomes-client', 'shantel@mapleandoakmanagement.com', '(678) 431-4166', NULL, NULL, NULL, NULL, 'QB Import May 2026', true),
  ('The Aster', 'client', 'the-aster-client', 'dbrooks@radco.us', NULL, '2900 Pharr Ct S Northwest', 'Atlanta', 'GA', '30305', 'QB Import May 2026', true),
  ('The Villages on Riverwalk', 'client', 'the-villages-on-riverwalk-client', 'shantel@mapleandoakmanagement.com', '(678) 431-4166', NULL, NULL, NULL, NULL, 'QB Import May 2026', true),
  ('TXP Texas - Monitoring', 'client', 'txp-texas-monitoring-client', NULL, NULL, NULL, NULL, NULL, NULL, 'QB Import May 2026', true);

-- Total: 35 organizations inserted