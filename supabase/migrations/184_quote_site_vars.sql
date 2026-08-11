-- Migration 184: known site variables on a quote/proposal.
-- Stores the rep's intake counts (units, vehicle gates, amenity/pedestrian gates,
-- call boxes, existing cameras to take over, new cameras) so the proposal builder's
-- Site Variables card can remember them and auto-drive the Gate Program pricing.
-- ALTER only — no GRANT block required (existing table permissions unchanged).

ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS site_vars JSONB;
