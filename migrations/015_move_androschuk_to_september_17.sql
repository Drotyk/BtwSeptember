UPDATE speakers
SET training_id = 'first-job',
    updated_at = NOW()
WHERE name = 'Сергій Андрощук'
  AND training_id = 'self-realization';
