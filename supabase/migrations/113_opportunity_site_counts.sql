-- Migration 113: structured site counts captured in the Survey stage that drive
-- the install/equipment cost in Financials (units already live on opportunities
-- via 107 and flow from Overview). One JSONB so we can grow it without migrations.
-- Shape: { gates, common_doors, common_locks, cameras }
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS site_counts jsonb;
