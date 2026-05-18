-- GateGuard OS — Migration 024: Todo Enhancements
-- Adds: recurrence, attachments, richer linked-record support

-- ── Recurrence columns ────────────────────────────────────────────────────────
ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS recurrence_type     text DEFAULT 'none'
    CHECK (recurrence_type IN ('none','daily','weekly','monthly','yearly')),
  ADD COLUMN IF NOT EXISTS recurrence_interval int  DEFAULT 1,   -- every N units
  ADD COLUMN IF NOT EXISTS recurrence_ends_at  date,             -- stop after this date
  ADD COLUMN IF NOT EXISTS parent_todo_id      uuid REFERENCES todos(id) ON DELETE SET NULL;

-- ── Attachments table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS todo_attachments (
  id           uuid primary key default gen_random_uuid(),
  todo_id      uuid not null references todos(id) on delete cascade,
  name         text not null,
  url          text not null,       -- Supabase Storage public/signed URL
  storage_path text,                -- internal storage path for deletion
  size_bytes   int,
  mime_type    text,
  uploaded_by  text not null,       -- Clerk user ID
  created_at   timestamptz not null default now()
);

ALTER TABLE todo_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_todo_attachments"
  ON todo_attachments USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_todo_attachments_todo ON todo_attachments(todo_id);
