INSERT INTO speakers (
    training_id,
    name,
    description,
    photo_file_id,
    sort_order,
    is_active
)
SELECT
    'leadership',
    'Сергій Притула',
    'Лідерство та командна робота: як об’єднувати людей і вести за собою',
    'asset:serhiy-prytula',
    0,
    TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM speakers WHERE name = 'Сергій Притула'
);

INSERT INTO speakers (
    training_id,
    name,
    description,
    photo_file_id,
    sort_order,
    is_active
)
SELECT
    'self-realization',
    'Грабовський Олександр',
    'Як реалізувати себе після навчання: знайти хорошу роботу чи створити власну справу?',
    'asset:oleksandr-grabovsky',
    1,
    TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM speakers WHERE name = 'Грабовський Олександр'
);
