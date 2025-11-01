🚀 Быстрый старт
1️⃣ Установи зависимости
npm install

2️⃣ Создай и заполни .env файл
cp .env.example .env


Заполни все переменные окружения:

COMMENT_API_URL — URL для отправки комментариев

BAZAR_API_URL — базовый URL Finbazar

PostgreSQL: PG_DB_HOST, PG_DB_PORT, PG_DB_NAME, PG_DB_USER, PG_DB_PASSWORD

Redis: REDIS_HOST, REDIS_PORT

Любые другие секреты/ключи (токены, API ключи)

3️⃣ Запуск проекта локально
# development
npm run start

# watch mode
npm run start:dev

# production mode
npm run start:prod

🐳 Docker для PostgreSQL и Redis

Создай docker-compose.yml для поднятия только Postgres и Redis:

version: '3.9'
services:
  postgres:
    image: postgres:15-alpine
    container_name: commentbot_postgres
    restart: always
    environment:
      POSTGRES_DB: ${PG_DB_NAME}
      POSTGRES_USER: ${PG_DB_USER}
      POSTGRES_PASSWORD: ${PG_DB_PASSWORD}
    ports:
      - "${PG_DB_PORT}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: commentbot_redis
    restart: always
    ports:
      - "${REDIS_PORT}:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:


Запуск:

docker-compose up -d

🔗 Архитектура и поток данных
+-------------------+          +-------------------+
|  Finbazar API     |<-------->| AuthService       |
|  (post/comment)   |          | (управление токенами) 
+-------------------+          +-------------------+
                                    |
                                    v
                             +----------------+
                             | Prisma/Postgres|
                             | (хранение      |
                             | аккаунтов)     |
                             +----------------+
                                    |
                                    v
                             +----------------+
                             | CommentService |
                             | (генерация и  |
                             | отправка      |
                             | комментариев) |
                             +----------------+
                                    |
                                    v
                             +----------------+
                             | Redis          |
                             | (кэш: отмеченные|
                             | посты)         |
                             +----------------+

⚡ Особенности

AuthService: управление аккаунтами, рефреш токенов, массовая переавторизация.

CommentService: выбор постов, генерация комментариев, публикация через актуальные токены.

Redis: хранение информации о уже обработанных постах, чтобы не дублировать комментарии.

PostgreSQL: хранение аккаунтов, токенов и статусов.

Поддержка запуска как локально, так и через Docker.

✅ Рекомендации

Перед запуском убедись, что .env заполнен корректно.

Для тестовых номеров OTP может быть фиксированный (1489).

Docker с Postgres и Redis нужно поднимать до старта приложения.

Cron в NestJS может автоматически обновлять токены и публиковать комментарии (позже можно добавить).