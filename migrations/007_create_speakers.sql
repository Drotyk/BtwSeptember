CREATE TABLE IF NOT EXISTS speakers (
    id BIGSERIAL PRIMARY KEY,
    training_id VARCHAR(64) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(2000) NOT NULL,
    photo_file_id VARCHAR(512),
    sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_speakers_training_id ON speakers (training_id);
CREATE INDEX IF NOT EXISTS idx_speakers_training_active_order
    ON speakers (training_id, is_active, sort_order, created_at);
