-- Fix column name: target_user_id → target_user_ids (BIGINT[])
-- The original table was created with singular name before migration 005 ran.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'target_user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'target_user_ids'
  ) THEN
    ALTER TABLE notifications RENAME COLUMN target_user_id TO target_user_ids;
  END IF;
END $$;
