-- 228: Move-in step 3 "Who gets access" — household confirmed by the resident + vehicles.
-- household (jsonb, from 227) now holds what the RESIDENT confirmed:
--   [{ first_name, last_name, email, phone, include: true|false, from_lease: true|false }]
alter table move_in_invites add column if not exists vehicles jsonb not null default '[]'::jsonb;  -- [{ make, model, color, plate, state }]
alter table move_in_invites add column if not exists access_confirmed_at timestamptz;
