-- Migration 154: design page sets + "does this device count on the BOM?"
--
-- THE PROBLEM (real money, not cosmetics):
-- A drawing set has several pages. The SAME physical device legitimately appears
-- on more than one of them —
--
--   Page 1  Overview            -> headend switch (the real one)
--   Page 2  Enclosure detail    -> the SAME switch, drawn again for clarity
--
-- Today every placed device counts toward the BOM, so that switch is counted
-- twice. We'd quote the customer for two switches and carry two expense lines.
-- Bad quote, skewed job costing, skewed margin. The drawing must be free to
-- show a device wherever it helps WITHOUT inventing hardware.
--
-- THE RULE: exactly ONE instance of a physical device counts. Every other
-- drawing of it is a REFERENCE — visible on the page, invisible to the BOM.
--
-- ALTER TABLE only — no new tables. Defaults preserve today's behaviour exactly
-- (every existing device keeps counting), so nothing changes until a device is
-- explicitly marked as a reference.

-- ── Pages within a drawing set ───────────────────────────────────────────────
-- floor_plans already has name/level. Add explicit ordering + what the sheet IS,
-- so a set reads: 1 Overview · 2 Enclosure detail · 3 Riser · 4 Headend.
ALTER TABLE public.floor_plans
  ADD COLUMN IF NOT EXISTS page_no INTEGER;

ALTER TABLE public.floor_plans
  ADD COLUMN IF NOT EXISTS sheet_type TEXT;   -- overview | enclosure | riser | headend | detail | as_built

-- Pages belonging to one set. NULL = a standalone plan (all existing rows).
ALTER TABLE public.floor_plans
  ADD COLUMN IF NOT EXISTS set_id UUID REFERENCES public.floor_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS floor_plans_set_page_idx ON public.floor_plans (set_id, page_no);

-- ── The BOM flag ─────────────────────────────────────────────────────────────
-- true  (default) = this instance IS the device; count it, quote it, cost it.
-- false           = a reference drawing of a device counted on another page.
--                   Shows on the page. Never hits the BOM, the quote, or cost.
ALTER TABLE public.floor_plan_devices
  ADD COLUMN IF NOT EXISTS include_in_bom BOOLEAN NOT NULL DEFAULT true;

-- Which instance is the real one. Set this when include_in_bom = false so the
-- drawing can say "same switch as page 1" instead of leaving a mystery — and so
-- renaming/swapping the real device can follow through to its references.
ALTER TABLE public.floor_plan_devices
  ADD COLUMN IF NOT EXISTS same_as_device_id UUID REFERENCES public.floor_plan_devices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS floor_plan_devices_bom_idx      ON public.floor_plan_devices (floor_plan_id, include_in_bom);
CREATE INDEX IF NOT EXISTS floor_plan_devices_same_as_idx  ON public.floor_plan_devices (same_as_device_id);

-- A reference must point at a DIFFERENT device — never at itself.
ALTER TABLE public.floor_plan_devices
  DROP CONSTRAINT IF EXISTS floor_plan_devices_same_as_not_self;
ALTER TABLE public.floor_plan_devices
  ADD CONSTRAINT floor_plan_devices_same_as_not_self
    CHECK (same_as_device_id IS NULL OR same_as_device_id <> id);

-- IMPLEMENTATION NOTE — the DB alone does NOT fix the BOM.
-- The BOM in app/design/floor-plans/page.tsx is computed from LIVE CANVAS STATE
-- (bom.rows), not from this table. The canvas device object must carry
-- include_in_bom too, and the BOM tally must skip anything false. Persisting the
-- flag here without that is a column nobody reads.
--
-- Suggested UX: when a device is dropped onto a page where that product already
-- exists on another page of the set, default include_in_bom = false and prefill
-- same_as_device_id — "Reference only — already counted on Page 1 (don't bill twice)".
-- The safe default is the one that can't over-bill a customer.

NOTIFY pgrst, 'reload schema';
