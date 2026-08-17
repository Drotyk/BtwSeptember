ALTER TABLE users
    ADD COLUMN IF NOT EXISTS training_ids TEXT[];

CREATE INDEX IF NOT EXISTS idx_users_training_ids ON users USING GIN (training_ids);
