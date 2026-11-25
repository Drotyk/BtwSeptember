# Production deployment

## Базові налаштування

- використовуйте `.env` і Argon2id-хеш для `ADMIN_PASSWORD_HASH`;
- встановіть `NODE_ENV=production` та `SECURE_COOKIES=true`;
- розмістіть HTTPS reverse proxy перед адмінпанеллю;
- не публікуйте порт PostgreSQL і не відкривайте адмінпанель напряму в Інтернет;
- обмежте доступ до адмінпанелі через VPN, firewall або reverse-proxy ACL.

Запускайте production Compose без локального override-файлу:

```bash
docker compose -f docker-compose.yml up --build -d
```

## Резервні копії та оновлення

Регулярно оновлюйте dependencies і запускайте `npm audit --omit=dev`. Резервуйте PostgreSQL через `pg_dump` у
зашифроване сховище та окремо перевіряйте відновлення.

## Моніторинг

- `/health/live` — liveness, не залежить від PostgreSQL;
- `/health/ready` — readiness, перевіряє міграції, стан бота та PostgreSQL.

Моніторте ці endpoints, помилки з correlation ID і дисковий простір.

## Обмеження

Rate limiting входу зберігається в пам’яті одного процесу; для кількох інстансів потрібен спільний rate-limit store.
Адмін-сесії зберігаються в PostgreSQL, але logout/revocation не є глобальним identity provider.

Документація не є юридичним висновком. Політику приватності, правила, строки зберігання та підстави обробки має
перевірити власник разом із відповідальним юристом.
