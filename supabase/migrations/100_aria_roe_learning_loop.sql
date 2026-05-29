-- Migration 100: ARIA ROE fields + learning loop user-verified flags
-- Adds: roe_detected, roe_providers, roe_expiry_year (new data points)
-- Adds: *_user_verified boolean flags (protect user corrections from AI overwrites)

-- ROE / bulk agreement data points
ALTER TABLE public.aria_properties
  ADD COLUMN IF NOT EXISTS roe_detected              BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS roe_providers             TEXT[],
  ADD COLUMN IF NOT EXISTS roe_expiry_year           INT,

  -- User-verified flags: when true, smart-merge upsert preserves these fields
  ADD COLUMN IF NOT EXISTS isp_providers_user_verified    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS video_providers_user_verified  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS roe_expiry_user_verified       BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dm_name_user_verified          BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dm_email_user_verified         BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dm_phone_user_verified         BOOLEAN DEFAULT FALSE;

-- Index for ROE expiry filtering
CREATE INDEX IF NOT EXISTS aria_properties_roe_expiry_idx
  ON public.aria_properties (roe_expiry_year)
  WHERE roe_expiry_year IS NOT NULL;

-- Index for ROE detected flag
CREATE INDEX IF NOT EXISTS aria_properties_roe_detected_idx
  ON public.aria_properties (roe_detected)
  WHERE roe_detected = TRUE;
