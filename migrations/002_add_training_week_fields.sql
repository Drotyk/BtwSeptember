ALTER TABLE users
    ALTER COLUMN age DROP NOT NULL,
    ALTER COLUMN age DROP DEFAULT;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(64),
    ADD COLUMN IF NOT EXISTS institution VARCHAR(150),
    ADD COLUMN IF NOT EXISTS course VARCHAR(50),
    ADD COLUMN IF NOT EXISTS trainings TEXT[],
    ADD COLUMN IF NOT EXISTS discovery_source VARCHAR(150),
    ADD COLUMN IF NOT EXISTS personal_data_consent BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS event_rules_consent BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_telegram_username ON users (telegram_username);
CREATE INDEX IF NOT EXISTS idx_users_institution ON users (institution);
