-- Keep the existing speaker record attached to the renamed active training.
UPDATE speakers
SET training_id = 'leadership',
    updated_at = NOW()
WHERE training_id = 'change'
  AND name = 'Сергій Притула';
