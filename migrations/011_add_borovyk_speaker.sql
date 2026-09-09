INSERT INTO speakers (
    training_id,
    name,
    description,
    photo_file_id,
    sort_order,
    is_active
)
SELECT
    'acting',
    'Костянтин Боровик',
    'Акторська майстерність на сцені та в житті',
    NULL,
    2,
    FALSE
WHERE NOT EXISTS (
    SELECT 1 FROM speakers WHERE name = 'Костянтин Боровик'
);
