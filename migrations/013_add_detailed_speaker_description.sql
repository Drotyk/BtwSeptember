ALTER TABLE speakers
    ADD COLUMN IF NOT EXISTS detailed_description VARCHAR(4000);

UPDATE speakers
SET detailed_description = description
WHERE detailed_description IS NULL;

ALTER TABLE speakers
    ALTER COLUMN detailed_description SET NOT NULL;
