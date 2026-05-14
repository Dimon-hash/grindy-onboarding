# Grindy Onboarding

Минимальный Java-проект для Telegram Mini App онбординга.

## Локально

```bash
mvn package
PORT=8080 java -jar target/grindy-onboarding-1.0.0.jar
```

Открыть `http://localhost:8080`.

## Production

Mini App развернут на `https://5.129.200.75.sslip.io/`.

## Деплой

```bash
mvn package
scp target/grindy-onboarding-1.0.0.jar user@server:/opt/grindy-onboarding/grindy-onboarding.jar
scp deploy/grindy-onboarding.service user@server:/tmp/grindy-onboarding.service
ssh user@server 'sudo mv /tmp/grindy-onboarding.service /etc/systemd/system/grindy-onboarding.service && sudo systemctl daemon-reload && sudo systemctl enable --now grindy-onboarding && sudo systemctl restart grindy-onboarding'
```

Для Telegram Mini App нужен публичный HTTPS URL. Токен бота не хранить в репозитории; после публикации URL привязать его в BotFather или через Bot API.
