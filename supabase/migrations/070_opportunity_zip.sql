-- Migration 070: add property_zip to opportunities
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS property_zip text;
