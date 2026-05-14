package com.foscar.grindy;

import java.util.ArrayList;
import java.util.List;

record SuggestionsResponse(
        List<ChoiceSuggestion> experience,
        List<ChoiceSuggestion> conditions,
        List<GoalSuggestion> goals,
        PlanSuggestion plan,
        String source
) {
    SuggestionsResponse normalized(String sourceOverride) {
        return new SuggestionsResponse(
                limit(experience, 4).stream().map(ChoiceSuggestion::normalized).toList(),
                limit(conditions, 4).stream().map(ChoiceSuggestion::normalized).toList(),
                limit(goals, 3).stream().map(GoalSuggestion::normalized).toList(),
                plan == null ? PlanSuggestion.fallback() : plan.normalized(),
                sourceOverride == null || sourceOverride.isBlank() ? (source == null || source.isBlank() ? "fallback" : source) : sourceOverride
        );
    }

    private static <T> List<T> limit(List<T> items, int size) {
        List<T> clean = new ArrayList<>();
        if (items != null) {
            for (T item : items) {
                if (item != null && clean.size() < size) {
                    clean.add(item);
                }
            }
        }
        return clean;
    }
}

record ChoiceSuggestion(String title, String description) {
    ChoiceSuggestion normalized() {
        return new ChoiceSuggestion(clean(title, "Свой сценарий"), clean(description, "Подходит под твою цель и текущий ритм."));
    }

    private static String clean(String value, String fallback) {
        String clean = value == null ? "" : value.trim();
        return clean.isBlank() ? fallback : clean;
    }
}

record GoalSuggestion(String duration, String title, String description, List<String> bullets, String accent) {
    GoalSuggestion normalized() {
        return new GoalSuggestion(
                clean(duration, "3 месяца"),
                clean(title, "Дойти до цели"),
                clean(description, "Понятная цель с реалистичным темпом и регулярными действиями."),
                bullets == null || bullets.isEmpty() ? List.of("Без резких перегрузок", "С понятными шагами", "С еженедельной проверкой") : bullets.stream().limit(4).map(String::trim).filter(item -> !item.isBlank()).toList(),
                clean(accent, "blue")
        );
    }

    private static String clean(String value, String fallback) {
        String clean = value == null ? "" : value.trim();
        return clean.isBlank() ? fallback : clean;
    }
}

record PlanSuggestion(String title, String summary, List<MilestoneSuggestion> milestones) {
    static PlanSuggestion fallback() {
        return new PlanSuggestion(
                "Твой план к цели",
                "План собран под твою цель и текущие условия.",
                List.of(
                        new MilestoneSuggestion("Вы здесь", "Сегодня начинаем"),
                        new MilestoneSuggestion("Первый месяц", "Собрать устойчивый ритм"),
                        new MilestoneSuggestion("Второй месяц", "Усилить результат без перегруза"),
                        new MilestoneSuggestion("Третий месяц", "Закрепить привычку и результат")
                )
        );
    }

    PlanSuggestion normalized() {
        List<MilestoneSuggestion> cleanMilestones = milestones == null || milestones.isEmpty()
                ? fallback().milestones()
                : milestones.stream().limit(5).map(MilestoneSuggestion::normalized).toList();
        return new PlanSuggestion(clean(title, "Твой план к цели"), clean(summary, "План собран под твою цель и текущие условия."), cleanMilestones);
    }

    private static String clean(String value, String fallback) {
        String clean = value == null ? "" : value.trim();
        return clean.isBlank() ? fallback : clean;
    }
}

record MilestoneSuggestion(String title, String description) {
    MilestoneSuggestion normalized() {
        return new MilestoneSuggestion(clean(title, "Этап"), clean(description, "Понятный следующий шаг"));
    }

    private static String clean(String value, String fallback) {
        String clean = value == null ? "" : value.trim();
        return clean.isBlank() ? fallback : clean;
    }
}
