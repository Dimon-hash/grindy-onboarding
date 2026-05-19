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

/**
 * Generates personalized onboarding choices and plans through the AI provider, with cached fallback data.
 */
public final class AiSuggestionService {
    private static final String DEFAULT_BASE_URL = "https://api.aitunnel.ru/v1";
    private static final String DEFAULT_LIGHT_MODEL = "gpt-4o-mini";
    private static final String DEFAULT_STANDARD_MODEL = "gpt-4o-mini";
    private static final String DEFAULT_STRONG_MODEL = "gpt-4o";
    private static final String PROMPT_VERSION = "20260519-ai-model-router-v1";

    private final Json json;
    private final UserStore userStore;
    private final HttpClient httpClient;
    private final String apiKey;
    private final String baseUrl;
    private final String lightModel;
    private final String standardModel;
    private final String strongModel;

    public AiSuggestionService(Json json, UserStore userStore) {
        this.json = json;
        this.userStore = userStore;
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(12)).build();
        this.apiKey = firstEnv("GRINDY_AI_API_KEY", "AITUNNEL_API_KEY");
        this.baseUrl = System.getenv().getOrDefault("GRINDY_AI_BASE_URL", DEFAULT_BASE_URL).replaceAll("/+$", "");
        this.lightModel = firstEnvWithFallback(DEFAULT_LIGHT_MODEL, "GRINDY_AI_MODEL_LIGHT", "GRINDY_AI_MODEL");
        this.standardModel = firstEnvWithFallback(DEFAULT_STANDARD_MODEL, "GRINDY_AI_MODEL_STANDARD", "GRINDY_AI_MODEL");
        this.strongModel = firstEnvWithFallback(DEFAULT_STRONG_MODEL, "GRINDY_AI_MODEL_STRONG");
    }

    public SuggestionsResponse suggestions(UserContext user, OnboardingData onboarding) throws IOException {
        OnboardingData clean = onboarding.normalized();
        String fingerprint = fingerprint(user.storageId(), clean);
        CachedSuggestions cached = userStore.readSuggestions(user.storageId());
        if (cached != null && fingerprint.equals(cached.fingerprint()) && cached.suggestions() != null) {
            return completeWithFallback(cached.suggestions(), fallback(user, clean), cached.suggestions().source());
        }

        ModelRoute route = routeFor(clean);
        SuggestionsResponse suggestions = generate(user, clean, route).normalized(null);
        userStore.saveSuggestions(user.storageId(), new CachedSuggestions(fingerprint, suggestions));
        return suggestions;
    }

    private SuggestionsResponse generate(UserContext user, OnboardingData onboarding, ModelRoute route) {
        if (apiKey.isBlank()) {
            return fallback(user, onboarding);
        }
        try {
            SuggestionsResponse ai = callModel(user, onboarding, route);
            return completeWithFallback(ai, fallback(user, onboarding), "ai");
        } catch (Exception error) {
            System.err.println("AI suggestions fallback: " + error.getMessage());
            return fallback(user, onboarding);
        }
    }

    private SuggestionsResponse callModel(UserContext user, OnboardingData onboarding, ModelRoute route) throws IOException, InterruptedException {
        Map<String, Object> requestBody = Map.of(
                "model", route.model(),
                "temperature", 0.58,
                "response_format", Map.of("type", "json_object"),
                "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt()),
                        Map.of("role", "user", "content", userPrompt(user, onboarding, route))
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
        // System prompt задаёт роль модели и жёсткую JSON-схему, чтобы фронт мог безопасно рисовать ответ.
        return """
                Ты не просто чат-бот, а AI-архитектор цели внутри приложения Grindy.
                Твоя задача: превратить сырой запрос пользователя в ясную цель, собрать недостающий контекст и построить персональный путь.
                Пиши по-русски, дружелюбно, без медицинских обещаний и без опасных советов.
                Варианты должны быть готовыми к выбору: пользователь нажимает и почти не редактирует.
                Каждый вариант обязан собирать полезный сигнал для будущего плана: стартовый уровень, прошлые попытки, время, ограничения, поддержку или желаемый темп.
                Не пиши общие советы. Любой текст должен отвечать на вопрос: "как это поможет построить точный план именно этому человеку?"
                Верни только JSON без markdown. Схема:
                {
                  "experience":[{"title":"...","description":"..."} x4],
                  "conditions":[{"title":"...","description":"..."} x4],
                  "goals":[{"duration":"...","title":"...","description":"...","bullets":["..."],"accent":"blue|orange|green"} x3],
                  "plan":{"title":"...","summary":"...","milestones":[{"title":"...","description":"..."} x6-8]},
                  "source":"ai"
                }
                Все варианты должны быть персональными под цель пользователя и отличаться между собой по смыслу, а не только словами.
                План обязан использовать выбранные experience, conditions и selectedGoal. Если данных мало, делай разумные предположения и явно закладывай проверку в первой неделе.
                """;
    }

    private String userPrompt(UserContext user, OnboardingData onboarding, ModelRoute route) {
        // История уточнений передаётся отдельно: так модель понимает, какой следующий слой вопроса нужен.
        return """
                User seed: %s
                AI route: %s
                Причина выбора модели: %s
                Цель пользователя: %s
                Опыт: %s
                Уже выбранные уточнения опыта: %s
                Условия: %s
                Уже выбранные уточнения условий: %s
                Выбранная цель-карточка: %s
                Запрос на изменение плана: %s

                Сгенерируй варианты так, чтобы они выглядели как реальные ответы в онбординге, а не как общая статья.
                Если в "уже выбранных уточнениях" есть ответы, НЕ повторяй их. Сгенерируй следующий более глубокий вопрос-слой: варианты должны уточнять причины, частоту, ограничения, мотивацию или удобный темп.
                experience: 4 коротких готовых ответа про стартовый уровень и прошлые попытки. Если история опыта уже есть, углуби выбранную ветку.
                conditions: 4 коротких готовых ответа про время, ограничения, поддержку, среду или темп. Если история условий уже есть, углуби выбранную ветку.
                Каждый выбранный вариант должен помогать потом построить конкретный путь: частота действий, запасной сценарий, проверка прогресса, поддержка.
                Для goals.title пиши короткую готовую цель до 34 символов, без двоеточий, без пояснений и без "Добавить...".
                Примеры goals.title: "Набрать 5 кг мышц", "Сбросить 5 кг", "Учить английский 30 минут".
                Заголовки вариантов до 30 символов. Описания вариантов до 84 символов. Bullet до 34 символов.
                Для goals сделай 3 реально разные траектории:
                1) мягкая и безопасная,
                2) сбалансированная,
                3) более интенсивная.
                Для plan.summary кратко объясни логику пути: цель, темп, главный риск, как будем проверять прогресс.
                Для milestones пиши 7-8 прикладных этапов до 165 символов: что именно делать, как часто, с кем/чем сверяться и зачем.
                Обязательные этапы плана: уточнение метрики, первая неделя, регулярное действие, среда/поддержка, проверка прогресса, запасной сценарий, усиление, закрепление.
                """.formatted(
                shortHash(user.storageId()),
                route.tier(),
                route.reason(),
                clip(onboarding.goal(), 500),
                clip(onboarding.experience(), 260),
                clip(onboarding.experienceHistory(), 420),
                clip(onboarding.conditions(), 260),
                clip(onboarding.conditionsHistory(), 420),
                clip(onboarding.selectedGoal(), 220),
                clip(onboarding.selectedPlan(), 320)
        );
    }

    private ModelRoute routeFor(OnboardingData onboarding) {
        String goal = onboarding.goal().toLowerCase();
        boolean finalPlan = !onboarding.selectedGoal().isBlank() || !onboarding.selectedPlan().isBlank();
        boolean hasDeepContext = !onboarding.experienceHistory().isBlank() && !onboarding.conditionsHistory().isBlank();
        boolean complexGoal = onboarding.goal().length() >= 180
                || goal.matches(".*(здоров|похуд|вес|псих|отношен|девуш|деньг|бизнес|работ|переезд|экзамен).*");
        if (finalPlan || complexGoal && hasDeepContext) {
            return new ModelRoute("strong", strongModel, "финальный план или сложная цель требуют более сильной модели");
        }
        if (hasDeepContext || onboarding.goal().length() >= 90) {
            return new ModelRoute("standard", standardModel, "есть достаточно контекста для обычной персонализации");
        }
        return new ModelRoute("light", lightModel, "ранний быстрый слой подсказок без дорогого рассуждения");
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
                fallbackExperience(goal, onboarding.experienceHistory()),
                fallbackConditions(goal, onboarding.conditionsHistory()),
                fallbackGoals(goal, focus),
                fallbackPlan(goal, focus),
                "fallback"
        );
    }

    private List<ChoiceSuggestion> fallbackExperience(String goal, String history) {
        // Fallback тоже учитывает историю, чтобы приложение оставалось полезным даже без ответа AI-провайдера.
        if (!history.isBlank()) {
            String lowerHistory = history.toLowerCase();
            if (lowerHistory.matches(".*(нул|мало|начина).*")) {
                return List.of(
                        new ChoiceSuggestion("Нужен лёгкий старт", "Готов начинать с маленьких действий 10-15 минут."),
                        new ChoiceSuggestion("Важна структура", "Проще идти, когда есть расписание и понятные проверки."),
                        new ChoiceSuggestion("Боюсь сорваться", "Нужен запасной минимум на дни без сил и времени."),
                        new ChoiceSuggestion("Хочу поддержку", "Помогут подсказки, напоминания и внешняя обратная связь.")
                );
            }
            if (lowerHistory.matches(".*(рывк|срыв|нестаб|перерыв).*")) {
                return List.of(
                        new ChoiceSuggestion("Теряю регулярность", "Начинаю активно, но через неделю темп падает."),
                        new ChoiceSuggestion("Мешает перегруз", "Слишком большой план быстро становится тяжёлым."),
                        new ChoiceSuggestion("Не вижу прогресс", "Нужна простая метрика, чтобы понимать результат."),
                        new ChoiceSuggestion("Нет проверки", "Поможет еженедельный разбор и корректировка шагов.")
                );
            }
            return List.of(
                    new ChoiceSuggestion("Нужна конкретика", "Хочу точные действия, частоту и критерий выполнения."),
                    new ChoiceSuggestion("Нужен ритм", "Лучше двигаюсь, когда есть повторяемые короткие шаги."),
                    new ChoiceSuggestion("Нужна проверка", "Важно видеть, что работает, и вовремя менять план."),
                    new ChoiceSuggestion("Нужен запас", "План должен иметь лёгкую версию на сложные дни.")
            );
        }
        String lower = goal.toLowerCase();
        if (lower.matches(".*(девуш|подруг|знаком|отношен|свидан).*")) {
            return List.of(
                    new ChoiceSuggestion("Мало знакомств", "Редко знакомлюсь сам, нужен понятный старт без давления."),
                    new ChoiceSuggestion("Есть переписки", "Общение бывает, но не всегда доходит до реальных встреч."),
                    new ChoiceSuggestion("Стесняюсь начинать", "Нужны простые сценарии первого контакта и уверенный темп."),
                    new ChoiceSuggestion("Нужна система", "Хочу регулярные действия, а не ждать случайного момента.")
            );
        }
        return List.of(
                new ChoiceSuggestion("Начинаю с нуля", "Нужен простой старт, базовые шаги и понятная первая неделя."),
                new ChoiceSuggestion("Были рывки", "Пробовал начинать, но не хватало стабильности и проверки прогресса."),
                new ChoiceSuggestion("Есть рабочий опыт", "Уже знаю, что помогает, нужно собрать это в регулярный план."),
                new ChoiceSuggestion("Нужна поддержка", "Лучше двигаюсь, когда есть подсказки, обратная связь и контроль.")
        );
    }

    private List<ChoiceSuggestion> fallbackConditions(String goal, String history) {
        if (!history.isBlank()) {
            String lowerHistory = history.toLowerCase();
            if (lowerHistory.matches(".*(врем|график|занят).*")) {
                return List.of(
                        new ChoiceSuggestion("2-3 окна в неделю", "Реально выделять несколько коротких слотов заранее."),
                        new ChoiceSuggestion("Нужен минимум", "На загруженный день нужен шаг на 5-10 минут."),
                        new ChoiceSuggestion("Лучше вечером", "Основные действия проще делать после дел или учёбы."),
                        new ChoiceSuggestion("Лучше утром", "Нужно ставить важные действия до начала дня.")
                );
            }
            if (lowerHistory.matches(".*(поддерж|люд|окруж|команд).*")) {
                return List.of(
                        new ChoiceSuggestion("Нужен человек", "Поможет один человек для отчёта и поддержки."),
                        new ChoiceSuggestion("Нужны напоминания", "Важно не держать план в голове, а видеть подсказки."),
                        new ChoiceSuggestion("Нужна среда", "Нужно заранее подготовить место, материалы и условия."),
                        new ChoiceSuggestion("Меньше давления", "Поддержка должна помогать, а не создавать чувство вины.")
                );
            }
            return List.of(
                    new ChoiceSuggestion("Короткие шаги", "План должен помещаться в обычный день без перегруза."),
                    new ChoiceSuggestion("Гибкий график", "Нужны варианты на обычный и сложный день."),
                    new ChoiceSuggestion("Понятная метрика", "Важно быстро видеть, есть ли движение к цели."),
                    new ChoiceSuggestion("Внешняя опора", "Помогут люди, места, напоминания или готовая среда.")
            );
        }
        String lower = goal.toLowerCase();
        if (lower.matches(".*(девуш|подруг|знаком|отношен|свидан).*")) {
            return List.of(
                    new ChoiceSuggestion("Мало времени", "Нужны 2-3 коротких окна в неделю для общения и встреч."),
                    new ChoiceSuggestion("Нужны места", "Важно заранее выбрать, где знакомиться и куда приглашать."),
                    new ChoiceSuggestion("Нужна уверенность", "План должен снижать страх отказа и давать простые шаги."),
                    new ChoiceSuggestion("Без давления", "Хочу двигаться спокойно, без навязчивости и выгорания.")
            );
        }
        return List.of(
                new ChoiceSuggestion("Мало времени", "Нужны шаги по 10-20 минут, которые реально влезут в день."),
                new ChoiceSuggestion("Нужна гибкость", "Плану нужен запасной вариант для усталости и срывов графика."),
                new ChoiceSuggestion("Есть ограничения", "Важно учесть бюджет, здоровье, окружение или расписание."),
                new ChoiceSuggestion("Нужна среда", "Помогут люди, места, напоминания и заранее подготовленные условия.")
        );
    }

    private List<GoalSuggestion> fallbackGoals(String goal, String focus) {
        String lower = goal.toLowerCase();
        if (lower.matches(".*(девуш|подруг|знаком|отношен|свидан).*")) {
            return List.of(
                    new GoalSuggestion("1 месяц", "3 новых знакомства в неделю", "Мягкий старт, чтобы набрать практику общения.", List.of("Без давления", "2-3 окна в неделю", "Фиксировать выводы"), "blue"),
                    new GoalSuggestion("2 месяца", "Найти девушку для встреч", "Сбалансированный путь от общения к реальным встречам.", List.of("Профиль и места", "Регулярные контакты", "1 встреча в неделю"), "orange"),
                    new GoalSuggestion("3 месяца", "Уверенно строить общение", "Спокойно прокачать навык знакомств и поддержания контакта.", List.of("Практика диалогов", "Обратная связь", "Свой стиль общения"), "green")
            );
        }
        return List.of(
                new GoalSuggestion("3 месяца", titleFor(goal, "мягко"), "Реалистичный план с акцентом на " + focus + ".", List.of("Без перегруза", "Еженедельная проверка", "Понятные шаги"), "blue"),
                new GoalSuggestion("2 месяца", titleFor(goal, "активно"), "Более плотный темп, если готов выделять время регулярно.", List.of("Быстрый старт", "Чёткий график", "Контроль прогресса"), "orange"),
                new GoalSuggestion("4 месяца", titleFor(goal, "надолго"), "Спокойная траектория, чтобы результат закрепился.", List.of("Мягкий темп", "Запас на паузы", "Устойчивая привычка"), "green")
        );
    }

    private PlanSuggestion fallbackPlan(String goal, String focus) {
        String lower = goal.toLowerCase();
        if (lower.matches(".*(девуш|подруг|знаком|отношен|свидан).*")) {
            return new PlanSuggestion(
                    "Твой план к цели",
                    "Путь строится через регулярную практику общения, выбор подходящих мест и еженедельную проверку того, что реально работает.",
                    List.of(
                            new MilestoneSuggestion("Уточнить цель", "Определи формат: серьезные отношения, встречи или просто больше знакомств, чтобы не распыляться."),
                            new MilestoneSuggestion("Подготовить базу", "Обнови фото, короткое описание и список 5 мест или приложений, где комфортно знакомиться."),
                            new MilestoneSuggestion("Первая неделя", "Сделай 5 легких контактов без цели сразу понравиться: задача — снять напряжение и собрать опыт."),
                            new MilestoneSuggestion("Ритм общения", "Выдели 2-3 окна в неделю по 30-40 минут на переписки, прогулки или новые знакомства."),
                            new MilestoneSuggestion("Сценарии", "Заранее подготовь 3 первых сообщения и 2 идеи простой встречи, чтобы не зависать в моменте."),
                            new MilestoneSuggestion("Проверка", "Раз в неделю отмечай: сколько контактов, сколько ответов, что было легко и где возник ступор."),
                            new MilestoneSuggestion("Усиление", "Оставь каналы, где есть ответы, и добавь один новый способ знакомства только после стабильной недели."),
                            new MilestoneSuggestion("Закрепление", "Сформируй свой спокойный стиль общения и доводи удачные контакты до реальной встречи.")
                    )
            );
        }
        return new PlanSuggestion(
                "Твой план к цели",
                "План собран под цель: " + clip(goal, 80) + ". Темп: " + focus + ", проверка прогресса каждую неделю.",
                List.of(
                        new MilestoneSuggestion("Уточнить метрику", "Запиши конкретный результат, срок и показатель, по которому поймешь, что двигаешься верно."),
                        new MilestoneSuggestion("Первая неделя", "Выбери минимальное действие и сделай его 3 раза, чтобы проверить реальный стартовый уровень."),
                        new MilestoneSuggestion("Регулярный ритм", "Поставь 3-4 коротких окна в неделю и заранее реши, что делать в загруженный день."),
                        new MilestoneSuggestion("Среда", "Подготовь место, напоминания, людей или материалы, которые уменьшают трение перед действием."),
                        new MilestoneSuggestion("Проверка", "Раз в неделю сравни план и реальность: что получилось, где сорвалось и почему."),
                        new MilestoneSuggestion("Запасной сценарий", "Если день тяжелый, делай уменьшенную версию шага, но сохраняй контакт с целью."),
                        new MilestoneSuggestion("Усиление", "Когда базовый ритм держится неделю, добавь сложность только в одном параметре."),
                        new MilestoneSuggestion("Закрепление", "Оставь работающие действия, убери лишнее и определи следующий уровень без перегруза.")
                )
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
        return shortHash(PROMPT_VERSION + "|" + routeFor(onboarding).tier() + "|" + userId + "|" + onboarding.goal() + "|" + onboarding.experience() + "|" + onboarding.conditions() + "|" + onboarding.experienceHistory() + "|" + onboarding.conditionsHistory() + "|" + onboarding.selectedGoal() + "|" + onboarding.selectedPlan());
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

    private static String firstEnvWithFallback(String fallback, String... names) {
        String value = firstEnv(names);
        return value.isBlank() ? fallback : value;
    }

    private record ModelRoute(String tier, String model, String reason) {
    }
}
