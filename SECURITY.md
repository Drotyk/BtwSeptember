# Security policy

## Supported versions

Security fixes are applied to the current `main` branch. Deployments should use a reviewed commit,
not an unpinned mutable image.

## Reporting a vulnerability

Do not publish credentials, personal data, bot tokens, database dumps or exploit details in a public
issue. Contact the repository owner privately with:

- a short description and impact;
- affected commit or deployment;
- reproduction steps that do not expose real personal data;
- suggested mitigation, if available.

Rotate any exposed Telegram token, database password, admin credential or session secret immediately.

## Operational requirements

- keep `.env` outside Git and use an external secret store in production;
- use Argon2id for admin credentials;
- expose PostgreSQL only on the private container network;
- keep HTTPS and `SECURE_COOKIES=true` in production;
- review PostgreSQL backups and deletion requests according to the approved privacy policy;
- run CI, dependency audit and Docker image scanning before deployment.
