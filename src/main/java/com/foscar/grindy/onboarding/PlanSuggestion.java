package com.foscar.grindy.onboarding;

import java.util.List;

public record PlanSuggestion(String title, String summary, List<MilestoneSuggestion> milestones) {
    public static PlanSuggestion fallback() {
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

    public PlanSuggestion normalized() {
        List<MilestoneSuggestion> cleanMilestones = milestones == null || milestones.isEmpty()
                ? fallback().milestones()
                : milestones.stream().limit(5).map(MilestoneSuggestion::normalized).toList();
        return new PlanSuggestion(
                clean(title, "Твой план к цели", 44),
                clean(summary, "План собран под твою цель и текущие условия.", 120),
                cleanMilestones
        );
    }

    private static String clean(String value, String fallback, int limit) {
        String clean = value == null ? "" : value.trim();
        if (clean.isBlank()) {
            return fallback;
        }
        return clean.length() <= limit ? clean : clean.substring(0, limit);
    }
}
