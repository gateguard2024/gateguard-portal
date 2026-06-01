-- Migration 104: Tracker item assignee + due date
-- Adds owner_user_id (FK to Clerk user ID string) and due_date columns to tracker_items.
-- Also adds a search API helper index for calendar queries.

ALTER TABLE public.tracker_items
  ADD COLUMN IF NOT EXISTS owner_user_id TEXT,
  ADD COLUMN IF NOT EXISTS due_date       DATE;

-- Index for calendar events query (items with due dates, filtered by assignee)
CREATE INDEX IF NOT EXISTS idx_tracker_items_due_date
  ON public.tracker_items(due_date)
  WHERE due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tracker_items_owner_user
  ON public.tracker_items(owner_user_id)
  WHERE owner_user_id IS NOT NULL;
