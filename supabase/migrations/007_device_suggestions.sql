-- Migration 007: device_suggestions
-- AI-extracted terminal definitions from uploaded product manuals.
-- Supplements the static wiring library in lib/wiring-library.ts.

CREATE TABLE IF NOT EXISTS device_suggestions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  device_def   JSONB NOT NULL,          -- DeviceDef shape from wiring-library.ts
  wiring_hints JSONB DEFAULT '[]'::jsonb,  -- plain-english pairing notes from Claude
  status       TEXT NOT NULL DEFAULT 'ai_generated',
                  -- ai_generated | verified | rejected
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id)
);

-- Index for fast lookup by product
CREATE INDEX IF NOT EXISTS idx_device_suggestions_product
  ON device_suggestions(product_id);

-- Only verified + ai_generated entries are surfaced to the wiring diagram
CREATE INDEX IF NOT EXISTS idx_device_suggestions_status
  ON device_suggestions(status);

-- RLS: service role can read/write; anon can read verified entries
ALTER TABLE device_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON device_suggestions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON device_suggestions
  FOR SELECT TO authenticated USING (status IN ('ai_generated', 'verified'));
