-- Fix column type: target_user_ids BIGINT → BIGINT[]
-- Migration 006 only renamed target_user_id → target_user_ids but did not
-- change the scalar type to array, because migration 005's CREATE TABLE IF
-- NOT EXISTS was a no-op (table already existed with the old schema).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications'
      AND column_name = 'target_user_ids'
      AND data_type = 'bigint'
      AND udt_name = 'int8'
  ) THEN
    ALTER TABLE notifications
      ALTER COLUMN target_user_ids TYPE BIGINT[]
      USING CASE WHEN target_user_ids IS NULL THEN NULL ELSE ARRAY[target_user_ids] END;
  END IF;
END $$;
