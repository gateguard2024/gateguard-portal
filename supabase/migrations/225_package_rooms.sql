-- ============================================================
-- Migration 225 — Package rooms (Part 14 · Nexus Parcel)
-- Run on BETA first, verify, then PROD.
--
-- One property can have one or more package rooms. Each room has its own Jetson
-- (edge_device_id) + ESP32 room controller, rotating color "day" sections plus fixed
-- spots (oversized floor, fridge, staff hold, yellow unsorted shelf).
--   package_rooms       the room, its devices, fee settings, setup checklist, service mode
--   package_sections    Blue / Green / … day sections + fixed spots (LED range per section)
--   package_sessions    every visit: a driver delivery, a resident pickup, service, staff
--   packages            every box: who it's for, where it is, status, fee
--   package_events      audit trail / package timeline
--   package_exceptions  "Needs attention": no owner, wrong pickup, dumped, unlogged boxes,
--                       door propped, tailgate, aging, room health, key used, …
-- The app reads/writes these ONLY with the service-role key (Nexus + property portal APIs,
-- and later the Jetson ingest API). RLS on + service_role policy, no anon grants.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.package_rooms (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name            text NOT NULL DEFAULT 'Package Room',
  status          text NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'live', 'offline')),
  edge_device_id  text,            -- Jetson, e.g. gge-00012
  controller_id   text,            -- ESP32 room controller
  door_panel_id   text,            -- outside door panel tablet
  settings        jsonb NOT NULL DEFAULT '{}'::jsonb,   -- fees, unit ranges, alert rules
  checklist       jsonb NOT NULL DEFAULT '{}'::jsonb,   -- setup step -> { at, by }
  health          jsonb NOT NULL DEFAULT '{}'::jsonb,   -- last report from the Jetson
  last_seen_at    timestamptz,
  service_until   timestamptz,     -- Service mode: door unlocked, alerts paused, until this time
  service_by      text,
  service_note    text,
  created_by      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS package_rooms_site_idx ON public.package_rooms (site_id);

CREATE TABLE IF NOT EXISTS public.package_sections (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id        uuid NOT NULL REFERENCES public.package_rooms(id) ON DELETE CASCADE,
  name           text NOT NULL,                 -- Blue, Green, Floor, Fridge, Staff hold, Yellow
  color          text NOT NULL DEFAULT '#2F6FE0',
  kind           text NOT NULL DEFAULT 'day' CHECK (kind IN ('day', 'oversized', 'cold', 'staff', 'unsorted')),
  sort           int  NOT NULL DEFAULT 0,
  led_start      int,
  led_end        int,
  assigned_date  date,                          -- day sections: the delivery date it holds now
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS package_sections_room_idx ON public.package_sections (room_id, sort);

CREATE TABLE IF NOT EXISTS public.package_sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id        uuid NOT NULL REFERENCES public.package_rooms(id) ON DELETE CASCADE,
  site_id        uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  kind           text NOT NULL DEFAULT 'delivery' CHECK (kind IN ('delivery', 'pickup', 'service', 'staff')),
  entry_method   text,       -- label_scan, amazon_key, usps_key, keypad, call, app, qr, text_code, key, service
  carrier        text,
  actor_name     text,       -- resident / staff name when known (drivers are photographed, not named)
  photo_url      text,       -- entry photo
  started_at     timestamptz NOT NULL DEFAULT now(),
  ended_at       timestamptz,
  boxes_scanned  int NOT NULL DEFAULT 0,
  boxes_seen     int,        -- camera count of new boxes on the shelves
  source         text NOT NULL DEFAULT 'edge',  -- edge | office | test
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS package_sessions_room_idx ON public.package_sessions (room_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.packages (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id            uuid NOT NULL REFERENCES public.package_rooms(id) ON DELETE CASCADE,
  site_id            uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  session_id         uuid REFERENCES public.package_sessions(id) ON DELETE SET NULL,
  pickup_session_id  uuid REFERENCES public.package_sessions(id) ON DELETE SET NULL,
  tracking           text,
  carrier            text,
  recipient_name     text,
  unit               text,
  section_id         uuid REFERENCES public.package_sections(id) ON DELETE SET NULL,
  spot               text,        -- "lower shelf, middle"
  size               text NOT NULL DEFAULT 'box' CHECK (size IN ('envelope', 'box', 'oversized')),
  flags              text[] NOT NULL DEFAULT '{}',   -- cold, medication, signature, damaged
  status             text NOT NULL DEFAULT 'received'
                       CHECK (status IN ('received', 'unsorted', 'notified', 'picked_up', 'staff_hold', 'flagged', 'returned', 'abandoned')),
  label_photo_url    text,
  shelf_photo_url    text,
  received_at        timestamptz NOT NULL DEFAULT now(),
  notified_at        timestamptz,
  picked_up_at       timestamptz,
  picked_up_by       text,
  fee_paused_ms      bigint NOT NULL DEFAULT 0,   -- room-down time doesn't count toward fees
  fee_cents          int NOT NULL DEFAULT 0,      -- posted at pickup
  fee_waived         boolean NOT NULL DEFAULT false,
  fee_posted_at      timestamptz,
  source             text NOT NULL DEFAULT 'edge' CHECK (source IN ('edge', 'office', 'test')),
  logged_by          text,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS packages_room_status_idx ON public.packages (room_id, status, received_at DESC);
CREATE INDEX IF NOT EXISTS packages_site_idx ON public.packages (site_id, received_at DESC);
CREATE INDEX IF NOT EXISTS packages_unit_idx ON public.packages (room_id, unit);
-- One live record per tracking number per room (a second scan of the same box is the same box).
CREATE UNIQUE INDEX IF NOT EXISTS packages_room_tracking_uniq
  ON public.packages (room_id, tracking) WHERE tracking IS NOT NULL AND status <> 'returned';

CREATE TABLE IF NOT EXISTS public.package_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     uuid NOT NULL REFERENCES public.package_rooms(id) ON DELETE CASCADE,
  package_id  uuid REFERENCES public.packages(id) ON DELETE CASCADE,
  kind        text NOT NULL,   -- received, notified, moved, picked_up, staff_hold, released, returned, fee_waived, note, service_on, service_off, …
  actor       text,
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS package_events_pkg_idx ON public.package_events (package_id, created_at);
CREATE INDEX IF NOT EXISTS package_events_room_idx ON public.package_events (room_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.package_exceptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      uuid NOT NULL REFERENCES public.package_rooms(id) ON DELETE CASCADE,
  site_id      uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  package_id   uuid REFERENCES public.packages(id) ON DELETE SET NULL,
  session_id   uuid REFERENCES public.package_sessions(id) ON DELETE SET NULL,
  kind         text NOT NULL CHECK (kind IN ('no_owner', 'wrong_pickup', 'dumped', 'unlogged', 'door_propped', 'tailgate',
                                             'lingering', 'aging', 'abandoned', 'room_health', 'key_used', 'damaged', 'other')),
  severity     text NOT NULL DEFAULT 'warn' CHECK (severity IN ('info', 'warn', 'alert')),
  title        text NOT NULL,
  detail       text,
  clip_url     text,
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  source       text NOT NULL DEFAULT 'edge',
  resolved_at  timestamptz,
  resolved_by  text,
  resolution   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS package_exceptions_open_idx ON public.package_exceptions (room_id, status, created_at DESC);

-- RLS: service role only (same pattern as migration 175).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['package_rooms', 'package_sections', 'package_sessions', 'packages', 'package_events', 'package_exceptions'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "service_role_all_%s" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "service_role_all_%s" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;
