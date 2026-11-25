# BTW

BTW — Telegram-бот для реєстрації на тренінги. Учасники обирають тренінги й переглядають спікерів, а організатори
керують анкетами, переглядають статистику та планують розсилки у вебпанелі.

## Можливості

- приватна Telegram-анкета з вибором кількох тренінгів, поверненням назад і редагуванням;
- збереження сесій і даних у PostgreSQL, захист від повторної реєстрації та інструменти приватності;
- захищена адмінпанель із керуванням анкетами, статистикою, тренінгами та розсилками;
- організатор керує спікерами в адмінпанелі, а учасники переглядають їх через `/speakers`;
- автоматичні міграції, health endpoints і graceful shutdown.

## Стек

TypeScript, Node.js, Grammy, PostgreSQL, Node HTTP server, Vitest і Docker.
Telegram-бот і вебпанель використовують спільну PostgreSQL, а заплановані повідомлення надсилає фоновий Волкер.

## Швидкий старт

Потрібні Node.js 22+, PostgreSQL 16+ або Docker, токен Telegram-бота, URL політики приватності та правил BTW.

1. Скопіюйте `.env.example` у `.env` і заповніть обов’язкові змінні: `BOT_TOKEN`, `DATABASE_URL`, `PRIVACY_POLICY_URL`,
   `EVENT_RULES_URL`, версії документів, `ADMIN_USERNAME` та `ADMIN_PASSWORD_HASH`.
2. Згенеруйте хеш пароля адміністратора:

```bash
npm install
npm run admin:hash
```

Вставте отриманий Argon2id-хеш у `.env`. Повний список змінних наведено в [.env.example](.env.example).

Для локального запуску з PostgreSQL у Docker:

```bash
docker compose up -d postgres
npm run migrate:up
npm run dev
```

Міграції застосовуються автоматично під час запуску; вручну їх можна запустити через `npm run migrate:up`.

Для запуску всього застосунку в Docker:

```bash
docker compose up --build
```

Production-налаштування, резервні копії, моніторинг і обмеження кількох інстансів описані
в [docs/deployment.md](docs/deployment.md).

## Перевірки

```bash
npm run check
npm run test:coverage
```

`npm run check` запускає форматування, lint, typecheck, тести та build. Покриття перевіряється окремо.
Результати тих самих перевірок публікує [GitHub Actions CI](.github/workflows/ci.yml).

## Документація

- [Production deployment](docs/deployment.md) — HTTPS, Docker, резервні копії, моніторинг і обмеження;
- [Правила BTW](content/rules.md) — текст правил для учасників;
- `/rules` у боті показує актуальні правила. Після редагування `content/rules.md` потрібно оновити
  `EVENT_RULES_VERSION`.
