package com.foscar.grindy.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.foscar.grindy.auth.UserContext;
import com.foscar.grindy.json.Json;
import com.foscar.grindy.onboarding.CachedSuggestions;
import com.foscar.grindy.onboarding.ChoiceSuggestion;
import com.foscar.grindy.onboarding.GoalSuggestion;
import com.foscar.grindy.onboarding.MilestoneSuggestion;
import com.foscar.grindy.onboarding.OnboardingData;
import com.foscar.grindy.onboarding.PlanSuggestion;
import com.foscar.grindy.onboarding.SuggestionsResponse;
import com.foscar.grindy.user.UserStore;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

public final class AiSuggestionService {
    private static final String DEFAULT_BASE_URL = "https://api.aitunnel.ru/v1";
    private static final String DEFAULT_MODEL = "gpt-4o-mini";
    private static final String PROMPT_VERSION = "20260517-plan-fit-choices";

    private final Json json;
    private final UserStore userStore;
    private final HttpClient httpClient;
    private final String apiKey;
    private final String baseUrl;
    private final String model;

    public AiSuggestionService(Json json, UserStore userStore) {
        this.json = json;
        this.userStore = userStore;
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(12)).build();
        this.apiKey = firstEnv("GRINDY_AI_API_KEY", "AITUNNEL_API_KEY");
        this.baseUrl = System.getenv().getOrDefault("GRINDY_AI_BASE_URL", DEFAULT_BASE_URL).replaceAll("/+$", "");
        this.model = System.getenv().getOrDefault("GRINDY_AI_MODEL", DEFAULT_MODEL);
    }

    public SuggestionsResponse suggestions(UserContext user, OnboardingData onboarding) throws IOException {
        OnboardingData clean = onboarding.normalized();
        String fingerprint = fingerprint(user.storageId(), clean);
        CachedSuggestions cached = userStore.readSuggestions(user.storageId());
        if (cached != null && fingerprint.equals(cached.fingerprint()) && cached.suggestions() != null) {
            return completeWithFallback(cached.suggestions(), fallback(user, clean), cached.suggestions().source());
        }

        SuggestionsResponse suggestions = generate(user, clean).normalized(null);
        userStore.saveSuggestions(user.storageId(), new CachedSuggestions(fingerprint, suggestions));
        return suggestions;
    }

    private SuggestionsResponse generate(UserContext user, OnboardingData onboarding) {
        if (apiKey.isBlank()) {
            return fallback(user, onboarding);
        }
        try {
            SuggestionsResponse ai = callModel(user, onboarding);
            return completeWithFallback(ai, fallback(user, onboarding), "ai");
        } catch (Exception error) {
            System.err.println("AI suggestions fallback: " + error.getMessage());
            return fallback(user, onboarding);
        }
    }

    private SuggestionsResponse callModel(UserContext user, OnboardingData onboarding) throws IOException, InterruptedException {
        Map<String, Object> requestBody = Map.of(
                "model", model,
                "temperature", 0.86,
                "response_format", Map.of("type", "json_object"),
                "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt()),
                        Map.of("role", "user", "content", userPrompt(user, onboarding))
                )
        );
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/chat/completions"))
                .timeout(Duration.ofSeconds(35))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.write(requestBody), StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IOException("AI provider returned " + response.statusCode());
        }
        JsonNode root = json.tree(response.body());
        String content = root.path("choices").path(0).path("message").path("content").asText("");
        return json.read(stripCodeFence(content), SuggestionsResponse.class);
    }

    private String systemPrompt() {
        return """
                Ты продуктовый AI-коуч для приложения Grindy. Нужно создавать короткие, конкретные варианты ответов и план достижения цели.
                Пиши по-русски, дружелюбно, без медицинских обещаний и без опасных советов.
                Варианты должны быть готовыми к выбору: пользователь нажимает и почти не редактирует.
                Каждый вариант обязан собирать полезный сигнал для будущего плана: стартовый уровень, прошлые попытки, время, ограничения, поддержку или желаемый темп.
                Верни только JSON без markdown. Схема:
                {
                  "experience":[{"title":"...","description":"..."} x4],
                  "conditions":[{"title":"...","description":"..."} x4],
                  "goals":[{"duration":"...","title":"...","description":"...","bullets":["..."],"accent":"blue|orange|green"} x3],
                  "plan":{"title":"...","summary":"...","milestones":[{"title":"...","description":"..."} x6-8]},
                  "source":"ai"
                }
                Все варианты должны быть персональными под цель пользователя и отличаться между собой по смыслу, а не только словами.
                """;
    }

    private String userPrompt(UserContext user, OnboardingData onboarding) {
        return """
                User seed: %s
                Цель пользователя: %s
                Опыт: %s
                Условия: %s

                Сгенерируй варианты так, чтобы они выглядели как реальные ответы в онбординге, а не как общая статья.
                experience: 4 разных варианта про стартовый уровень и прошлые попытки. Не повторяй цель в каждом описании.
                conditions: 4 разных варианта про время, ограничения, поддержку, среду или темп. Не делай все варианты про "гибкость".
                Каждый выбранный вариант должен помогать потом построить конкретный путь: частота действий, запасной сценарий, проверка прогресса, поддержка.
                Для goals.title пиши короткую готовую цель до 34 символов, без двоеточий, без пояснений и без "Добавить...".
                Примеры goals.title: "Набрать 5 кг мышц", "Сбросить 5 кг", "Учить английский 30 минут".
                Заголовки вариантов до 30 символов. Описания вариантов до 84 символов. Bullet до 34 символов.
                Для milestones в плане пиши 6-8 прикладных этапов до 150 символов: что именно делать, как часто, с кем/чем сверяться и зачем.
                """.formatted(
                shortHash(user.storageId()),
                clip(onboarding.goal(), 500),
                clip(onboarding.experience(), 260),
                clip(onboarding.conditions(), 260)
        );
    }

    private SuggestionsResponse completeWithFallback(SuggestionsResponse ai, SuggestionsResponse fallback, String source) {
        SuggestionsResponse cleanAi = ai == null ? fallback : ai.normalized(source);
        return new SuggestionsResponse(
                cleanAi.experience().isEmpty() ? fallback.experience() : cleanAi.experience().stream().map(ChoiceSuggestion::normalized).toList(),
                cleanAi.conditions().isEmpty() ? fallback.conditions() : cleanAi.conditions().stream().map(ChoiceSuggestion::normalized).toList(),
                cleanAi.goals().isEmpty() ? fallback.goals() : cleanAi.goals().stream().map(GoalSuggestion::normalized).toList(),
                cleanAi.plan() == null ? fallback.plan() : cleanAi.plan().normalized(),
                source
        );
    }

    private SuggestionsResponse fallback(UserContext user, OnboardingData onboarding) {
        String goal = onboarding.goal().isBlank() ? "цель" : onboarding.goal();
        int variant = Math.abs(shortHash(user.storageId() + goal).hashCode()) % 3;
        String focus = switch (variant) {
            case 1 -> "спокойный темп";
            case 2 -> "быстрый старт";
            default -> "устойчивый ритм";
        };
        return new SuggestionsResponse(
                List.of(
                        new ChoiceSuggestion("Начинаю с нуля", "Нужен простой старт, базовые шаги и понятная первая неделя."),
                        new ChoiceSuggestion("Были рывки", "Пробовал начинать, но не хватало стабильности и проверки прогресса."),
                        new ChoiceSuggestion("Есть рабочий опыт", "Уже знаю, что помогает, нужно собрать это в регулярный план."),
                        new ChoiceSuggestion("Нужна поддержка", "Лучше двигаюсь, когда есть подсказки, обратная связь и контроль.")
                ),
                List.of(
                        new ChoiceSuggestion("Мало времени", "Нужны шаги по 10-20 минут, которые реально влезут в день."),
                        new ChoiceSuggestion("Нужна гибкость", "Плану нужен запасной вариант для усталости и срывов графика."),
                        new ChoiceSuggestion("Есть ограничения", "Важно учесть бюджет, здоровье, окружение или расписание."),
                        new ChoiceSuggestion("Нужна среда", "Помогут люди, места, напоминания и заранее подготовленные условия.")
                ),
                List.of(
                        new GoalSuggestion("3 месяца", titleFor(goal, "мягко"), "Реалистичный план с акцентом на " + focus + ".", List.of("Без перегруза", "Еженедельная проверка", "Понятные шаги"), "blue"),
                        new GoalSuggestion("2 месяца", titleFor(goal, "активно"), "Более плотный темп, если готов выделять время регулярно.", List.of("Быстрый старт", "Чёткий график", "Контроль прогресса"), "orange"),
                        new GoalSuggestion("4 месяца", titleFor(goal, "надолго"), "Спокойная траектория, чтобы результат закрепился.", List.of("Мягкий темп", "Запас на паузы", "Устойчивая привычка"), "green")
                ),
                new PlanSuggestion(
                        "Твой план к цели",
                        "План собран под цель: " + clip(goal, 80),
                        List.of(
                                new MilestoneSuggestion("Вы здесь", "Сегодня фиксируем старт и первый шаг"),
                                new MilestoneSuggestion("Первая неделя", "Собрать минимальный ритм и выбрать короткие действия на каждый день"),
                                new MilestoneSuggestion("Неделя 2", "Настроить напоминания, поддержку и запасной вариант для сложных дней"),
                                new MilestoneSuggestion("Первый месяц", "Убрать главные препятствия и закрепить действия в обычном графике"),
                                new MilestoneSuggestion("Проверка прогресса", "Раз в неделю сравнивать план и реальность, затем упрощать слабые места"),
                                new MilestoneSuggestion("Поддержка", "Подключить людей, среду или привычные триггеры, чтобы не держаться только на мотивации"),
                                new MilestoneSuggestion("Закрепление", "Сохранить работающие действия и подготовить следующий уровень без перегруза")
                        )
                ),
                "fallback"
        );
    }

    private String titleFor(String goal, String mode) {
        String compact = goal.replaceAll("\\s+", " ").trim();
        String lower = compact.toLowerCase();
        if (lower.matches(".*(мышц|мышеч|накач|зал|трен|сил).*")) {
            return switch (mode) {
                case "активно" -> "Увеличить силу";
                case "надолго" -> "Закрепить тренировки";
                default -> "Набрать 4-6 кг мышц";
            };
        }
        if (lower.matches(".*(похуд|вес|жир|сброс).*")) {
            return switch (mode) {
                case "активно" -> "Сбросить 5 кг";
                case "надолго" -> "Удержать новый вес";
                default -> "Похудеть без срывов";
            };
        }
        String clean = compact
                .replaceFirst("(?iu)^я\\s+хочу\\s+", "")
                .replaceFirst("(?iu)^хочу\\s+", "")
                .replaceAll("[.:;]+$", "")
                .trim();
        if (clean.length() < 8) {
            return "Дойти до цели";
        }
        return clip(clean, 34);
    }

    private String fingerprint(String userId, OnboardingData onboarding) {
        return shortHash(PROMPT_VERSION + "|" + userId + "|" + onboarding.goal() + "|" + onboarding.experience() + "|" + onboarding.conditions());
    }

    private String shortHash(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8))).substring(0, 16);
        } catch (NoSuchAlgorithmException error) {
            return Integer.toHexString(value.hashCode());
        }
    }

    private String clip(String value, int max) {
        String clean = value == null ? "" : value.trim();
        return clean.length() <= max ? clean : clean.substring(0, max);
    }

    private String stripCodeFence(String content) {
        String clean = content == null ? "" : content.trim();
        if (clean.startsWith("```")) {
            clean = clean.replaceFirst("^```(?:json)?\\s*", "");
            clean = clean.replaceFirst("\\s*```$", "");
        }
        return clean;
    }

    private static String firstEnv(String... names) {
        for (String name : names) {
            String value = System.getenv(name);
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return "";
    }
}
