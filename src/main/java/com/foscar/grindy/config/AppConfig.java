package com.foscar.grindy.config;

import java.nio.file.Path;

public record AppConfig(
        int port,
        Path dataDir,
        String telegramBotToken,
        boolean allowLocalAuth
) {
    private static final int DEFAULT_PORT = 8080;

    public static AppConfig fromEnv() {
        String environment = env("GRINDY_ENV", "development");
        boolean production = "production".equalsIgnoreCase(environment);
        return new AppConfig(
                Integer.parseInt(env("PORT", String.valueOf(DEFAULT_PORT))),
                Path.of(env("GRINDY_DATA_DIR", "data")),
                env("GRINDY_TELEGRAM_BOT_TOKEN", ""),
                Boolean.parseBoolean(env("GRINDY_ALLOW_LOCAL_AUTH", production ? "false" : "true"))
        );
    }

    public boolean telegramAuthRequired() {
        return !allowLocalAuth && !telegramBotToken.isBlank();
    }

    private static String env(String key, String fallback) {
        String value = System.getenv(key);
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
