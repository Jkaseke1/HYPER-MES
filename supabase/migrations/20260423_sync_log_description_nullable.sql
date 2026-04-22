-- Fix: prod sync_log has a NOT NULL "description" column (added manually outside migrations)
-- that no trigger populates, causing bulk issue-materials and other sync inserts to fail.
-- The human-readable text is already stored in sync_log.message; description is redundant.
-- Relax the NOT NULL constraint and give it a default so legacy triggers keep working.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'sync_log'
      AND column_name  = 'description'
  ) THEN
    ALTER TABLE sync_log ALTER COLUMN description DROP NOT NULL;
    ALTER TABLE sync_log ALTER COLUMN description SET DEFAULT '';
    UPDATE sync_log SET description = '' WHERE description IS NULL;
    RAISE NOTICE 'sync_log.description relaxed to nullable with empty default.';
  ELSE
    RAISE NOTICE 'sync_log.description does not exist — nothing to do.';
  END IF;
END $$;
