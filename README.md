# Grindy Onboarding

Минимальный Java-проект для Telegram Mini App онбординга.

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
