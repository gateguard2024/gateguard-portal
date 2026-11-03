-- Migration 215: Gate Watch "Right? Yes" answers save their picture as source 'confirmed'.
-- Migration 210 only allowed 'setup' | 'feedback'. (The code falls back to 'feedback' until this runs.)
ALTER TABLE public.gate_watch_refs DROP CONSTRAINT IF EXISTS gate_watch_refs_source_check;
ALTER TABLE public.gate_watch_refs ADD CONSTRAINT gate_watch_refs_source_check CHECK (source IN ('setup','feedback','confirmed'));
