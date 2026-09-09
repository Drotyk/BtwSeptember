# BTW

Production-oriented Telegram-бот і захищена адміністративна панель для реєстрації учасників BTW.
Бот збирає мінімально необхідні дані: ім’я, український номер телефону, Telegram ID і username
(якщо username встановлений), навчальний заклад, курс, обрані тренінги та джерело інформації.
Дані зберігаються в PostgreSQL.

Стек: TypeScript, Node.js, grammY, PostgreSQL, Node HTTP server, Vitest і Docker.

## Можливості

- приватна Telegram-анкета з поверненням назад, скасуванням і вибором кількох тренінгів;
- persistent PostgreSQL-backed сесії з TTL і відновленням після перезапуску;
- захист від повторної реєстрації та редагування наявної анкети;
- перевірка номера телефону та отримання username лише з Telegram update;
- підтвердження політики приватності та правил BTW із версіями й часом згоди;
- `/privacy`, `/mydata` і захищений `/delete_me`;
- адмін-панель із Argon2id, серверними сесіями, rate limiting і security headers;
- health/readiness endpoints, graceful shutdown і автоматичні міграції;
- структурований конфіг тренінгів через стабільні ID.
- динамічні спікери в PostgreSQL з CRUD у захищеній адмін-панелі та Telegram-каруселлю.

## Вимоги

- Node.js 22+;
- PostgreSQL 16+ або Docker;
- токен Telegram-бота;
- URL політики приватності та правил BTW;
- Argon2id-хеш пароля адміністратора.

## Локальний запуск

```bash
cp .env.example .env
npm install
npm run admin:hash
# вставте отриманий рядок у ADMIN_PASSWORD_HASH у .env
npm run migrate:up
npm run dev
```

Для локального PostgreSQL із Docker використовуйте `docker compose up -d postgres`. Override-файл
публікує PostgreSQL тільки на `127.0.0.1:55433`; базовий Compose-файл не публікує порт PostgreSQL.

## Docker

1. Скопіюйте `.env.example` у `.env`.
2. Замініть усі `replace_with_*` значення, створіть Argon2id-хеш пароля.
3. Запустіть:

```bash
docker compose up --build
```

Для production не підключайте `docker-compose.override.yml`, а використовуйте базовий файл:

```bash
docker compose -f docker-compose.yml up --build -d
```

Контейнер BTW працює від непривілейованого користувача. PostgreSQL отримує назву БД, користувача
і пароль зі змінних `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`. Не комітьте `.env`.

## Змінні середовища

Обов’язкові: `BOT_TOKEN`, `DATABASE_URL`, `PRIVACY_POLICY_URL`, `EVENT_RULES_URL`,
`PRIVACY_POLICY_VERSION`, `EVENT_RULES_VERSION`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`.

Основні додаткові змінні: `WEB_HOST`, `WEB_PORT`, `CHAT_INVITE_LINK`, `SECURE_COOKIES`,
`SESSION_TTL_SECONDS`, `ADMIN_SESSION_TTL_SECONDS` і `DROP_PENDING_UPDATES`.
`SESSION_TTL_SECONDS=259200` зберігає незавершену реєстрацію протягом 3 діб.
`DROP_PENDING_UPDATES=false` є безпечним значенням за замовчуванням і не втрачає pending updates.
У production встановіть `NODE_ENV=production` і `SECURE_COOKIES=true`.

`ADMIN_PASSWORD_HASH` має бути Argon2id-хешем, а не plaintext-паролем:

```bash
npm run admin:hash
```

## Команди бота

- `/start` - почати анкету або відкрити редагування для зареєстрованого користувача;
- `/back` - повернутися на попередній крок;
- `/cancel` - скасувати незавершену анкету;
- `/rules` - переглянути актуальні правила BTW і, за потреби, підтвердити їх;
- `/privacy` - політика та інформація про обробку даних;
- `/mydata` - показати власні збережені дані;
- `/delete_me` - запросити явне підтвердження видалення анкети.
- `/speakers` - переглянути актуальних спікерів у Telegram-каруселі.

Анкети обробляються тільки в приватних чатах. Групові чати не використовують спільний session key.

## Вебпанель і health endpoints

- `/` - адмін-панель після входу;
- `/login` - форма входу;
- `/health/live` - liveness, не залежить від PostgreSQL;
- `/health/ready` - readiness, перевіряє міграції, стан бота та PostgreSQL.

`/api/users` повертає дані тільки для активної серверної адмін-сесії. Cookie має `HttpOnly`,
`SameSite=Strict`, а в production також `Secure`. Публічна вебпанель без авторизації не має доступу
до персональних даних.

Вкладка `📊 Статистика` використовує захищений `/api/statistics` і показує зведені дані за всіма
анкетами: кількість учасників, вибір тренінгів, джерела залучення, заклади та курси.

## Міграції

Міграції застосовуються автоматично під час запуску або вручну:

```bash
npm run migrate:up
```

`001` і `002` - історичні міграції та не редагуються. Нові зміни знаходяться в `003`-`015`:

- `003_add_sessions_and_consent_metadata.sql` - Telegram/admin sessions і метадані згод, зокрема
  `event_rules_consent_at` та `event_rules_version`;
- `004_add_training_ids.sql` - стабільні ID тренінгів.
- `007_create_speakers.sql` - спікери, прив’язані до training ID, з активністю та порядком.
- `008_update_september_schedule.sql` і `009_reassign_september_speakers.sql` - оновлення
  прив’язок спікерів після зміни вересневого розкладу.
- `010_seed_september_speakers.sql` - початкове додавання двох спікерів із локальними фото.
- `011_add_borovyk_speaker.sql` - додавання Костянтина Боровика без фото до заповнення asset.
- `012_activate_borovik_speaker.sql` - підключення фото та активація Костянтина Боровика.
- `013_add_detailed_speaker_description.sql` - окреме поле для детального опису спікера.
- `014_add_androschuk_speaker.sql` - додавання Сергія Андрощука з локальним фото.
- `015_move_androschuk_to_september_17.sql` - прив’язка Сергія Андрощука до тренінгу 17.09.

## Speakers

Вкладка `🎤 Спікери` в адмін-панелі підтримує створення, редагування, деактивацію та видалення
спікерів. Спікер прив’язується до одного зі стабільних training ID. `sortOrder` визначає порядок
у Telegram-каруселі; за однакового значення використовується час створення.

Короткий опис показується в основній картці спікера, а детальний опис - після натискання кнопки
`📖 Детальніше`.

Фото можна вказати як Telegram `file_id` або як локальний asset із префіксом `asset:`. У репозиторії
вже доступні `asset:serhiy-prytula`, `asset:oleksandr-grabovsky`, `asset:borovik-konstantin` і
`asset:serhiy-androschuk`; бот завантажує такі JPG напряму
з каталогу `seeker`, не записуючи binary у PostgreSQL. Для інших фото можна отримати Telegram
`file_id` і вставити його у форму адмінки.

Кнопка `🎤 Спікери` або команда `/speakers` показує активні спікери вибраного тренінгу. Кнопки
навігації редагують одне повідомлення через Telegram API; поточний індекс не зберігається в
глобальному стані процесу, а кожен callback повторно перевіряє актуальний список у PostgreSQL.

## Архітектура

- `src/bot/create-bot.ts` - створення бота, middleware, error handler;
- `src/bot/handlers/` - commands, callbacks і registration handlers;
- `src/bot/keyboards.ts`, `messages.ts`, `registration-state.ts`, `types.ts` - UI та state machine;
- `src/services/registration.service.ts` - бізнес-правила збереження анкети;
- `src/services/rules.service.ts` і `content/rules.md` - джерело та розбиття тексту правил;
- `src/services/speaker.service.ts` і `src/services/telegram-speaker.service.ts` - speaker CRUD,
  валідація та динамічна Telegram-карусель;
- `src/repositories/` - PostgreSQL repositories для users, bot sessions і admin sessions;
- `src/web.ts`, `src/web/auth.ts` - HTTP-панель, авторизація та health endpoints;
- `migrations/` - послідовні SQL-міграції.

## Перевірки та тести

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
npm run check
npm audit --omit=dev
```

Coverage thresholds для перевіреної критичної логіки: lines/statements/functions 80%, branches 75%.

## Правила та acceptance

Текст правил знаходиться у `content/rules.md`. Поточна версія задається змінною
`EVENT_RULES_VERSION`; після зміни тексту або правил оновіть цю версію (наприклад, з `1.0` на `1.1`).
Нові розділи додаються безпосередньо до Markdown-файлу - бот автоматично розбиває довгий текст на
повідомлення, не обрізаючи його.

Перегляд через `/rules` або кнопку `📜 Правила BTW` не створює згоду. Згода фіксується лише після
натискання `✅ Я ознайомився та погоджуюсь`; для нового користувача вона зберігається у session до
фінального збереження анкети, а для наявного користувача оновлюється за його Telegram ID.
Перед завершенням реєстрації перевіряється саме поточна версія, timestamp і явна дія користувача.
Якщо версія змінилася, її потрібно прийняти повторно.

## Production deployment

- використовуйте секретне сховище для `.env` і Argon2id-хешу;
- розмістіть HTTPS reverse proxy перед панеллю та залиште `SECURE_COOKIES=true`;
- не публікуйте порт PostgreSQL і не відкривайте адмін-панель напряму в Інтернет;
- обмежте доступ до адмін-панелі через VPN, firewall або reverse-proxy ACL;
- регулярно оновлюйте dependencies і запускайте `npm audit --omit=dev`;
- резервуйте PostgreSQL через `pg_dump` у зашифроване сховище, перевіряйте restore окремо;
- моніторте `/health/live`, `/health/ready`, помилки з correlation ID і дисковий простір.

Документація не є юридичним висновком і не заявляє повної відповідності конкретному законодавству.
Політику приватності, правила, строки зберігання та підстави обробки має перевірити власник разом
із відповідальним юристом.

## Обмеження

Rate limiting входу зберігається в пам’яті одного процесу; для кількох інстансів потрібен спільний
rate-limit store. Адмін-сесії зберігаються в PostgreSQL, але logout/revocation не є глобальним
централізованим identity provider. Значення training labels для історичних записів залежать від
наявності legacy-масиву; нові записи мають стабільні `training_ids`.

## GitHub і CI

Workflow у `.github/workflows/ci.yml` запускає форматування, lint, typecheck, тести, build, audit і
Docker build. Для захисту гілки рекомендується вимагати CI, заборонити force-push до `main`, вимагати
pull request review і не дозволяти merge при failed checks. GitHub repository автоматично не перейменовується;
за потреби власник може окремо перейменувати його на `BTW`.
