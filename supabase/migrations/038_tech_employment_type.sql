ALTER TABLE technicians
  ADD COLUMN IF NOT EXISTS employment_type text NOT NULL DEFAULT 'employee'
    CHECK (employment_type IN ('employee', 'contractor')),
  ADD COLUMN IF NOT EXISTS clerk_user_id text,
  ADD COLUMN IF NOT EXISTS portal_invite_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS portal_invite_email text,
  ADD COLUMN IF NOT EXISTS can_access_portal boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS technicians_clerk_user_id_key
  ON technicians (clerk_user_id)
  WHERE clerk_user_id IS NOT NULL;
