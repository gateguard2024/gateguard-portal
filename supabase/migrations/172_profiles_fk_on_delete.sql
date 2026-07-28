-- Migration 172: let a user (profiles row) be deleted.
-- Foreign keys reference profiles(id) with no delete behavior, so deleting a user
-- who was ever assigned a lead / created a quote / etc. is blocked:
--   "still referenced from table leads ... leads_assigned_to_fkey".
-- Re-create each as ON DELETE SET NULL. Each is wrapped so that if a table/column
-- has since changed (e.g. work_orders.assigned_to now points elsewhere), that one
-- is skipped with a notice instead of aborting the whole migration.

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('leads',        'assigned_to', 'leads_assigned_to_fkey'),
      ('quotes',       'created_by',  'quotes_created_by_fkey'),
      ('work_orders',  'created_by',  'work_orders_created_by_fkey'),
      ('work_orders',  'assigned_to', 'work_orders_assigned_to_fkey'),
      ('invoices',     'created_by',  'invoices_created_by_fkey'),
      ('activity_log', 'actor_id',    'activity_log_actor_id_fkey')
    ) AS t(tbl, col, con)
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', rec.tbl, rec.con);
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.profiles(id) ON DELETE SET NULL', rec.tbl, rec.con, rec.col);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Skipped %.% (%): %', rec.tbl, rec.col, rec.con, SQLERRM;
    END;
  END LOOP;
END $$;
