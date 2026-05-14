# Grindy Onboarding

Production-ready Java + static frontend для Telegram Mini App онбординга Grindy.

Приложение собирает цель пользователя, генерирует персональные AI-варианты опыта, условий, целей и плана, сохраняет прогресс и проверяет Telegram Mini App авторизацию в production.

## Структура

```text
src/main/java/com/foscar/grindy
  ai/          AI suggestions через AITunnel/OpenAI-compatible API
  auth/        Telegram initData validation и signed app tokens
  config/      env-конфигурация
  http/        API router, static files, security headers, rate limit
  json/        Jackson wrapper
  onboarding/  DTO и нормализация onboarding/AI данных
  user/        file-based storage

src/main/resources/static
  app.js       frontend entrypoint
  js/          state/api/screens/validators/telegram modules
  styles/      CSS modules
```

## Локально

```bash
mvn package
PORT=8080 java -jar target/grindy-onboarding-1.0.0.jar
```

Открыть `http://localhost:8080`.

## AI-подсказки

Backend генерирует персональные варианты через OpenAI-compatible API AITunnel.
Ключ не хранится в репозитории, задаётся переменной окружения:

```bash
export AITUNNEL_API_KEY="sk-..."
export GRINDY_AI_MODEL="gpt-4o-mini"
```

Опционально можно переопределить endpoint:

```bash
export GRINDY_AI_BASE_URL="https://api.aitunnel.ru/v1"
```

Если ключ не задан или провайдер временно недоступен, backend отдаёт локальный fallback.

## Auth

В development можно использовать local auth:

```bash
GRINDY_ALLOW_LOCAL_AUTH=true
```

В production local auth должен быть выключен, а `GRINDY_TELEGRAM_BOT_TOKEN` обязателен. Backend проверяет подпись Telegram `initData`, после чего выдаёт signed app token для API.

## Production

Mini App развернут на `https://5.129.200.75.sslip.io/`.

Перед приглашением пользователей на production должны быть заданы:

```bash
GRINDY_ENV=production
GRINDY_ALLOW_LOCAL_AUTH=false
GRINDY_TELEGRAM_BOT_TOKEN=telegram-bot-token
AITUNNEL_API_KEY=sk-...
```

`GRINDY_TELEGRAM_BOT_TOKEN` нужен для проверки подписи Telegram Mini App `initData`. Без него нельзя безопасно отличить реального Telegram-пользователя от подделанного запроса.

Health-check:

```bash
curl https://5.129.200.75.sslip.io/api/health
```

## Деплой

```bash
mvn package
scp target/grindy-onboarding-1.0.0.jar user@server:/opt/grindy-onboarding/grindy-onboarding.jar
scp deploy/grindy-onboarding.service user@server:/tmp/grindy-onboarding.service
ssh user@server 'sudo mv /tmp/grindy-onboarding.service /etc/systemd/system/grindy-onboarding.service && sudo systemctl daemon-reload && sudo systemctl enable --now grindy-onboarding && sudo systemctl restart grindy-onboarding'
```

На сервере ключ кладётся в `/etc/grindy-onboarding.env`:

```bash
AITUNNEL_API_KEY=sk-...
GRINDY_AI_MODEL=gpt-4o-mini
GRINDY_TELEGRAM_BOT_TOKEN=...
```

Для Telegram Mini App нужен публичный HTTPS URL. Токен бота не хранить в репозитории; после публикации URL привязать его в BotFather или через Bot API.
