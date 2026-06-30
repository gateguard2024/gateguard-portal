-- Migration 141: persist ARIA social/community findings so they survive between
-- searches (today the social route only returns them to the screen and they're lost).
ALTER TABLE public.aria_properties ADD COLUMN IF NOT EXISTS social_posts     jsonb;
ALTER TABLE public.aria_properties ADD COLUMN IF NOT EXISTS community_notes  jsonb;
ALTER TABLE public.aria_properties ADD COLUMN IF NOT EXISTS property_phone   text;
ALTER TABLE public.aria_properties ADD COLUMN IF NOT EXISTS social_updated_at timestamptz;
