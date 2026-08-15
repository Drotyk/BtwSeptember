# Telegram-бот для BTW September

Бот послідовно збирає український номер телефону, ПІ (прізвище та ім’я без по батькові) та вік користувача й зберігає їх у PostgreSQL.

Стек: TypeScript, Node.js, grammY та PostgreSQL.

## Швидкий запуск через Docker

1. Створіть бота через [@BotFather](https://t.me/BotFather) і скопіюйте токен.
2. Створіть локальний `.env` на основі `.env.example` та вставте токен:

   ```bash
   cp .env.example .env
   ```

3. Запустіть PostgreSQL і бота:

   ```bash
   docker compose up --build
   ```

Таблиця `users` створюється автоматично під час старту бота. Дані зберігаються в volume `postgres-data`.

## Локальний запуск без Docker

Потрібні Node.js 20+ і запущений PostgreSQL.

```bash
npm install
cp .env.example .env
npm run build
npm start
```

Для локального запуску в `DATABASE_URL` використовується хост `localhost`. Значення `DATABASE_URL` з Docker Compose використовує хост `postgres`, тому воно призначене для контейнера бота.

Щоб запустити TypeScript-бот локально, але використовувати PostgreSQL із Docker:

```bash
docker compose up -d postgres
npm run build
npm start
```

У цьому режимі `DATABASE_URL` має використовувати порт `5433`. Порт `5432` може бути зайнятий локальним PostgreSQL.

Підтримувані команди: `/start` — почати або перезаповнити анкету, `/cancel` — скасувати поточний ввід.
