ALTER TABLE users
    ADD COLUMN IF NOT EXISTS personal_data_consent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS personal_data_policy_version VARCHAR(64),
    ADD COLUMN IF NOT EXISTS event_rules_consent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS event_rules_version VARCHAR(64);

CREATE TABLE IF NOT EXISTS bot_sessions (
    session_key VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bot_sessions_expires_at ON bot_sessions (expires_at);

CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash CHAR(64) PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions (expires_at);
