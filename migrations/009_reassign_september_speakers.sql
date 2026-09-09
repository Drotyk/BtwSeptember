-- Reassign an already-created speaker to the matching September training.
UPDATE speakers
SET training_id = 'self-realization',
    updated_at = NOW()
WHERE name IN ('Грабовський Олександр', 'Олександр Грабовський')
  AND training_id = 'tourism';
